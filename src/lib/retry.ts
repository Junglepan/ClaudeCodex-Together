/**
 * Retry an async fn while it throws errors that look like the backend is not yet
 * reachable (vite proxy returns 500 / fetch network error during cold start).
 */

const NETWORK_HINTS = [
  'API 500',
  'API 502',
  'API 503',
  'API 504',
  'Failed to fetch',
  'NetworkError',
  'ECONNREFUSED',
]

export function isLikelyBackendNotReady(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return NETWORK_HINTS.some((h) => msg.includes(h))
}

export async function withColdStartRetry<T>(
  fn: () => Promise<T>,
  { attempts = 5, baseMs = 300, maxMs = 2500 }: { attempts?: number; baseMs?: number; maxMs?: number } = {},
): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      last = e
      if (!isLikelyBackendNotReady(e) || i === attempts - 1) throw e
      const delay = Math.min(baseMs * 2 ** i, maxMs)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw last
}
