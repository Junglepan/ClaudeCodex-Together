import os from 'node:os'
import path from 'node:path'
import type { SessionRuntimeOptions } from './sessionTypes'

export function sessionWatchPaths(options: SessionRuntimeOptions = {}) {
  const home = options.homeDir ?? os.homedir()
  return [
    path.join(home, '.claude', 'projects'),
    path.join(home, '.codex', 'sessions'),
  ]
}
