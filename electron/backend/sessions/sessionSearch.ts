import type { SearchSessionsRequest, SessionRuntimeOptions, SessionSearchHit } from './sessionTypes'
import { getSessionDetail, listSessions } from './index'

export async function searchSessionMessages(request: SearchSessionsRequest, options: SessionRuntimeOptions = {}): Promise<SessionSearchHit[]> {
  const query = request.query.trim().toLowerCase()
  if (!query) return []
  const sessions = await listSessions(request, options)
  const hits: SessionSearchHit[] = []

  for (const session of sessions) {
    const detail = await getSessionDetail({ agent: session.agent, sessionId: session.id }, options)
    for (const message of detail.messages) {
      if (request.role && message.role !== request.role) continue
      if (request.toolName && message.toolName !== request.toolName) continue
      const index = message.content.toLowerCase().indexOf(query)
      if (index === -1) continue
      hits.push({
        session,
        messageId: message.id,
        role: message.role,
        excerpt: excerpt(message.content, index, query.length),
      })
    }
  }

  return hits
}

function excerpt(content: string, index: number, length: number) {
  const start = Math.max(0, index - 60)
  const end = Math.min(content.length, index + length + 60)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < content.length ? '...' : ''
  return `${prefix}${content.slice(start, end)}${suffix}`
}
