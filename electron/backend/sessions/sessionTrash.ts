import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { DeleteSessionRequest, DeleteSessionResult, SessionRuntimeOptions } from './sessionTypes'
import { listSessions } from './index'

export async function trashSession(request: DeleteSessionRequest, options: SessionRuntimeOptions = {}): Promise<DeleteSessionResult> {
  const home = options.homeDir ?? os.homedir()
  const sessions = await listSessions({ agent: request.agent, scope: 'all' }, options)
  const session = sessions.find((candidate) => candidate.id === request.sessionId)
  if (!session) throw new Error(`Session not found: ${request.sessionId}`)

  const stamp = (options.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-')
  const trashDir = path.join(home, '.cc-steward', 'trash', 'sessions', request.agent, `${stamp}-${request.sessionId}`)
  await fs.mkdir(trashDir, { recursive: true })
  const trashPath = path.join(trashDir, path.basename(session.path))
  await fs.rename(session.path, trashPath)
  await fs.writeFile(path.join(trashDir, 'manifest.json'), JSON.stringify({
    originalPath: session.path,
    trashPath,
    agent: session.agent,
    deletionTimestamp: (options.now?.() ?? new Date()).toISOString(),
    projectPath: session.projectPath,
  }, null, 2))

  return { deleted: true, originalPath: session.path, trashPath }
}
