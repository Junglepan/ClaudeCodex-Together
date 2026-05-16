import type { TokenUsage } from './sessionTypes'

export function emptyTokenUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }
}

export function addTokenUsage(target: TokenUsage, source: TokenUsage): void {
  target.inputTokens += source.inputTokens
  target.outputTokens += source.outputTokens
  target.cacheCreationTokens += source.cacheCreationTokens
  target.cacheReadTokens += source.cacheReadTokens
}
