import path from 'node:path'
import { parse } from 'smol-toml'
import { dirEntries, exists, homeDir, readJsonSafe, readText } from './fsUtils'
import type { ApiResolvedConfig, ResolvedScopeItem } from './types'

function hasOwn(target: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(target, key)
}

function compactJson(value: unknown) {
  const text = JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

function readTomlSafe(target: string): Record<string, unknown> {
  if (!exists(target)) return {}
  try {
    return parse(readText(target)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function scopedEntries(globalDir: string, projectDir: string | null, suffix?: string): ResolvedScopeItem[] {
  const globalNames = new Set(dirEntries(globalDir).flatMap((name) => suffix && !name.endsWith(suffix) ? [] : [suffix ? name.slice(0, -suffix.length) : name]))
  const projectNames = new Set(projectDir ? dirEntries(projectDir).flatMap((name) => suffix && !name.endsWith(suffix) ? [] : [suffix ? name.slice(0, -suffix.length) : name]) : [])
  const items: ResolvedScopeItem[] = []

  for (const name of [...globalNames].sort()) {
    items.push({ name, source: 'global', overridden_by: projectNames.has(name) ? 'project' : null })
  }
  for (const name of [...projectNames].filter((name) => !globalNames.has(name)).sort()) {
    items.push({ name, source: 'project', overridden_by: null })
  }
  return items
}

export function resolveClaude(home = homeDir(), project?: string | null): ApiResolvedConfig {
  const globalSettingsPath = path.join(home, '.claude', 'settings.json')
  const projectSettingsPath = project ? path.join(project, '.claude', 'settings.json') : null
  const localSettingsPath = project ? path.join(project, '.claude', 'settings.local.json') : null

  const globalData = exists(globalSettingsPath) ? readJsonSafe(globalSettingsPath) : {}
  const projectData = projectSettingsPath && exists(projectSettingsPath) ? readJsonSafe(projectSettingsPath) : {}
  const localData = localSettingsPath && exists(localSettingsPath) ? readJsonSafe(localSettingsPath) : {}
  const layers = [
    ['global', globalData],
    ['project', projectData],
    ['local_override', localData],
  ] as const

  const allKeys = new Set([...Object.keys(globalData), ...Object.keys(projectData), ...Object.keys(localData)])
  const settings = [...allKeys].sort().map((key) => {
    const layersWithKey = layers.filter(([, data]) => hasOwn(data, key))
    if (key === 'hooks' || key === 'permissions') {
      const merged = layersWithKey.flatMap(([, data]) => Array.isArray(data[key]) ? data[key] as unknown[] : [data[key]])
      return {
        key,
        value: compactJson(merged),
        source: layersWithKey.length > 1 ? 'merged' as const : layersWithKey[0][0],
        overrides: [],
      }
    }
    const sources = layersWithKey.map(([source]) => source)
    return {
      key,
      value: compactJson(layersWithKey[layersWithKey.length - 1][1][key]),
      source: sources[sources.length - 1],
      overrides: sources.slice(0, -1),
    }
  })

  return {
    agent: 'claude',
    project: project ?? null,
    settings,
    instructions: [
      { path: path.join(home, '.claude', 'CLAUDE.md'), exists: exists(path.join(home, '.claude', 'CLAUDE.md')), order: 1, scope: 'global' },
      ...(project ? [{ path: path.join(project, 'CLAUDE.md'), exists: exists(path.join(project, 'CLAUDE.md')), order: 2, scope: 'project' as const }] : []),
    ],
    skills: scopedEntries(path.join(home, '.claude', 'skills'), project ? path.join(project, '.claude', 'skills') : null),
    agents: scopedEntries(path.join(home, '.claude', 'agents'), project ? path.join(project, '.claude', 'agents') : null, '.md'),
  }
}

export function resolveCodex(home = homeDir(), project?: string | null): ApiResolvedConfig {
  const globalConfigPath = path.join(home, '.codex', 'config.toml')
  const projectConfigPath = project ? path.join(project, '.codex', 'config.toml') : null
  const globalData = readTomlSafe(globalConfigPath)
  const projectData = projectConfigPath ? readTomlSafe(projectConfigPath) : {}

  const settings = [...new Set([...Object.keys(globalData), ...Object.keys(projectData)])]
    .filter((key) => !['mcp_servers', 'features', 'projects'].includes(key))
    .sort()
    .map((key) => {
      const sources: Array<'global' | 'project'> = []
      let value: unknown
      if (hasOwn(globalData, key)) {
        sources.push('global')
        value = globalData[key]
      }
      if (hasOwn(projectData, key)) {
        sources.push('project')
        value = projectData[key]
      }
      const text = String(value)
      return {
        key,
        value: text.length > 80 ? `${text.slice(0, 77)}...` : text,
        source: sources[sources.length - 1],
        overrides: sources.slice(0, -1),
      }
    })

  return {
    agent: 'codex',
    project: project ?? null,
    settings,
    instructions: [
      { path: path.join(home, '.codex', 'AGENTS.md'), exists: exists(path.join(home, '.codex', 'AGENTS.md')), order: 1, scope: 'global' },
      ...(project ? [{ path: path.join(project, 'AGENTS.md'), exists: exists(path.join(project, 'AGENTS.md')), order: 2, scope: 'project' as const }] : []),
    ],
    skills: scopedEntries(path.join(home, '.codex', 'skills'), project ? path.join(project, '.codex', 'skills') : null),
    agents: scopedEntries(path.join(home, '.codex', 'agents'), project ? path.join(project, '.codex', 'agents') : null, '.toml'),
  }
}

export function resolvedConfig(agent: string, project?: string | null) {
  if (agent === 'claude') return resolveClaude(homeDir(), project)
  if (agent === 'codex') return resolveCodex(homeDir(), project)
  throw new Error(`Resolved config not supported for agent '${agent}'`)
}
