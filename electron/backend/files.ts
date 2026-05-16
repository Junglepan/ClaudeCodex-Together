import fs from 'node:fs'
import path from 'node:path'
import { counterpartFor, getAgent, getAgentFile, readAgentFile } from './agents'
import { homeDir, isFile, readText } from './fsUtils'

const settingsKeys = new Set(['global_settings', 'project_settings'])

function ensureAllowed(target: string) {
  const resolved = path.resolve(target)
  const roots = [
    path.join(homeDir(), '.claude'),
    path.join(homeDir(), '.codex'),
    path.join(homeDir(), '.agents'),
    path.join(homeDir(), '.claude.json'),
    path.join(homeDir(), 'AGENTS.md'),
    process.env.CC_STEWARD_PROJECT || process.env.CCT_PROJECT || process.cwd(),
  ].map((root) => path.resolve(root))
  if (!roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) {
    throw new Error(`路径越权：${target} 不在允许的范围内`)
  }
}

function backupFile(target: string) {
  if (!fs.existsSync(target) || !isFile(target)) return null
  const backup = `${target}.bak.${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}`
  fs.copyFileSync(target, backup)
  return backup
}

function parseHooks(content: string) {
  try {
    const data = JSON.parse(content) as { hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ command?: string }> }>> }
    return Object.entries(data.hooks ?? {}).flatMap(([event, groups]) =>
      Array.isArray(groups)
        ? groups.flatMap((group) => Array.isArray(group.hooks)
          ? group.hooks.map((hook) => ({
              event,
              matcher: group.matcher ?? null,
              command: hook.command ?? '',
              script_path: null,
              script_exists: null,
            }))
          : [])
        : [],
    )
  } catch {
    return []
  }
}

export function fileMeta(agentId: string, key: string, project?: string | null) {
  const agent = getAgent(agentId)
  if (!agent) throw new Error(`Agent '${agentId}' not found`)
  const file = getAgentFile(agentId, key, project)
  if (!file) throw new Error(`File key '${key}' not found for agent '${agentId}'`)
  const content = file.exists && file.kind === 'file' ? readAgentFile(agentId, key, project) : null
  const counterpart = counterpartFor(agentId, key, project)
  return {
    path: file.path,
    exists: file.exists,
    content,
    purpose: file.purpose,
    details: file.details,
    counterpart_agent: file.counterpart_agent,
    counterpart_path: counterpart?.path ?? null,
    counterpart_exists: counterpart?.exists ?? null,
    parsed_hooks: settingsKeys.has(key) && content ? parseHooks(content) || null : null,
  }
}

export function readFile(target: string) {
  if (!fs.existsSync(target)) throw new Error('File not found')
  if (!isFile(target)) throw new Error('Path is a directory')
  return { path: target, content: readText(target) }
}

export function writeFile(target: string, content: string, backup = true) {
  const resolved = path.resolve(target)
  ensureAllowed(resolved)
  const backupPath = backup ? backupFile(resolved) : null
  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  fs.writeFileSync(resolved, content, 'utf8')
  return { path: resolved, written: true, backup_path: backupPath }
}

export function deleteFile(target: string) {
  const resolved = path.resolve(target)
  ensureAllowed(resolved)
  if (!fs.existsSync(resolved)) throw new Error('File not found')
  if (!isFile(resolved)) throw new Error('Path is a directory')
  const backupPath = backupFile(resolved)
  fs.unlinkSync(resolved)
  return { path: resolved, deleted: true, backup_path: backupPath }
}
