import path from 'node:path'
import os from 'node:os'
import { collectSessionFiles, readSessionDetail, stripDetail } from './claudeSessions'
import type { SessionDetail, SessionSummary } from './sessionTypes'

export function codexSessionRoot(homeDir = os.homedir()) {
  return path.join(homeDir, '.codex', 'sessions')
}

export async function listCodexSessions(homeDir?: string): Promise<SessionSummary[]> {
  const files = await collectSessionFiles(codexSessionRoot(homeDir))
  const summaries = await Promise.all(files.map(readCodexSession))
  return summaries.map(stripDetail).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function readCodexSession(filePath: string): Promise<SessionDetail> {
  return readSessionDetail('codex', filePath)
}
