import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'smol-toml'
import { homeDir, isDirectory, readText } from './fsUtils'
import type { ApiProject } from './types'

export function discoverFromCodex(home = homeDir()): ApiProject[] {
  const configPath = path.join(home, '.codex', 'config.toml')
  if (!fs.existsSync(configPath)) return []

  let projectPaths: string[] = []
  try {
    const data = parse(readText(configPath)) as { projects?: Record<string, unknown> }
    projectPaths = Object.keys(data.projects ?? {})
  } catch {
    projectPaths = [...readText(configPath).matchAll(/^\[projects\."([^"]+)"\]/gm)].map((match) => match[1])
  }

  return projectPaths.map((projectPath) => ({
    path: projectPath,
    name: path.basename(projectPath) || projectPath,
    exists: isDirectory(projectPath),
    source: 'codex' as const,
    last_used: null,
  }))
}

function decodeClaudeProjectDir(encoded: string): string | null {
  const segments = encoded.split('-')
  const choices = ['/', '-', '_']

  function backtrack(index: number, current: string): string | null {
    if (index === segments.length - 1) {
      const candidate = current + segments[index]
      return isDirectory(candidate) ? candidate : null
    }
    for (const choice of choices) {
      const result = backtrack(index + 1, current + segments[index] + choice)
      if (result) return result
    }
    return null
  }

  return segments.length ? backtrack(0, '/') : null
}

export function discoverFromClaude(home = homeDir()): ApiProject[] {
  const projectsDir = path.join(home, '.claude', 'projects')
  if (!isDirectory(projectsDir)) return []

  return fs.readdirSync(projectsDir)
    .sort()
    .flatMap((entry) => {
      const entryPath = path.join(projectsDir, entry)
      if (!isDirectory(entryPath)) return []
      const decoded = decodeClaudeProjectDir(entry)
      if (!decoded) return []
      return [{
        path: decoded,
        name: path.basename(decoded) || decoded,
        exists: isDirectory(decoded),
        source: 'claude' as const,
        last_used: fs.statSync(entryPath).mtimeMs / 1000,
      }]
    })
}

export function mergeProjects(codexList: ApiProject[], claudeList: ApiProject[]): ApiProject[] {
  const seen = new Map<string, ApiProject>()

  for (const item of [...codexList, ...claudeList]) {
    let key = path.resolve(item.path)
    try {
      key = fs.realpathSync.native(item.path)
    } catch {
      key = path.resolve(item.path)
    }
    const existing = seen.get(key)
    if (existing) {
      if (existing.source !== item.source) existing.source = 'both'
      if (existing.last_used === null || (item.last_used !== null && item.last_used > existing.last_used)) {
        existing.last_used = item.last_used
      }
    } else {
      seen.set(key, { ...item })
    }
  }

  return [...seen.values()].sort((a, b) => {
    if (a.exists !== b.exists) return a.exists ? -1 : 1
    const aUsed = a.last_used ?? -1
    const bUsed = b.last_used ?? -1
    if (aUsed !== bUsed) return bUsed - aUsed
    return a.name.localeCompare(b.name)
  })
}

export function listProjects() {
  const home = homeDir()
  return mergeProjects(discoverFromCodex(home), discoverFromClaude(home))
}
