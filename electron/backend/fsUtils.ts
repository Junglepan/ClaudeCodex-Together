import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export function homeDir() {
  return os.homedir()
}

export function projectRoot() {
  return process.env.CC_STEWARD_PROJECT || process.env.CCT_PROJECT || path.resolve(__dirname, '..')
}

export function exists(target: string) {
  return fs.existsSync(target)
}

export function isFile(target: string) {
  try {
    return fs.statSync(target).isFile()
  } catch {
    return false
  }
}

export function isDirectory(target: string) {
  try {
    return fs.statSync(target).isDirectory()
  } catch {
    return false
  }
}

export function readText(target: string) {
  return fs.readFileSync(target, 'utf8')
}

export function readJsonSafe(target: string): Record<string, unknown> {
  try {
    return JSON.parse(readText(target)) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function dirEntries(target: string) {
  if (!isDirectory(target)) return []
  return fs.readdirSync(target).sort()
}

export function fileInfo(target: string) {
  const stat = fs.statSync(target)
  return {
    size: stat.isFile() ? stat.size : undefined,
    modified: stat.isFile() ? new Date(stat.mtimeMs).toISOString().slice(0, 19) : undefined,
  }
}

export function resolveTemplate(template: string, project?: string | null) {
  return template
    .replace(/{home}/g, homeDir())
    .replace(/{project}/g, project || projectRoot())
}
