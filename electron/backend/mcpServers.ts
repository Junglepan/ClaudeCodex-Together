import path from 'node:path'
import { parse } from 'smol-toml'
import { exists, homeDir, readJsonSafe, readText } from './fsUtils'

export interface McpServerItem {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  source: 'global' | 'project'
  origin: string
}

function extractMcpFromJson(filePath: string, source: 'global' | 'project'): McpServerItem[] {
  if (!exists(filePath)) return []
  const data = readJsonSafe(filePath)
  const servers = (data.mcpServers ?? data.mcp_servers ?? {}) as Record<string, unknown>
  return Object.entries(servers).map(([name, cfg]) => {
    const config = cfg as Record<string, unknown> | null ?? {}
    return {
      name,
      command: String(config.command ?? ''),
      args: Array.isArray(config.args) ? config.args.map(String) : [],
      env: typeof config.env === 'object' && config.env !== null
        ? Object.fromEntries(Object.entries(config.env as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
        : {},
      source,
      origin: filePath,
    }
  })
}

function extractMcpFromToml(filePath: string, source: 'global' | 'project'): McpServerItem[] {
  if (!exists(filePath)) return []
  try {
    const data = parse(readText(filePath)) as Record<string, unknown>
    const servers = (data.mcp_servers ?? {}) as Record<string, unknown>
    return Object.entries(servers).map(([name, cfg]) => {
      const config = cfg as Record<string, unknown> | null ?? {}
      return {
        name,
        command: String(config.command ?? ''),
        args: Array.isArray(config.args) ? config.args.map(String) : [],
        env: typeof config.env === 'object' && config.env !== null
          ? Object.fromEntries(Object.entries(config.env as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
          : {},
        source,
        origin: filePath,
      }
    })
  } catch {
    return []
  }
}

export function listMcpServers(agent: string, project?: string | null): McpServerItem[] {
  const home = homeDir()

  if (agent === 'claude') {
    const results: McpServerItem[] = []
    results.push(...extractMcpFromJson(path.join(home, '.claude', 'settings.json'), 'global'))
    if (project) {
      results.push(...extractMcpFromJson(path.join(project, '.mcp.json'), 'project'))
      results.push(...extractMcpFromJson(path.join(project, '.claude', 'settings.json'), 'project'))
    }
    return results
  }

  const results: McpServerItem[] = []
  results.push(...extractMcpFromToml(path.join(home, '.codex', 'config.toml'), 'global'))
  if (project) {
    results.push(...extractMcpFromToml(path.join(project, '.codex', 'config.toml'), 'project'))
  }
  return results
}
