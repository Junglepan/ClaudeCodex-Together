import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'smol-toml'
import { homeDir, isDirectory, readText } from './fsUtils'

export interface SubagentItem {
  name: string
  description: string
  source: 'global' | 'project'
  path: string
  content: string
  format: 'md' | 'toml'
  tools?: string[]
}

function parseMdFrontmatter(content: string) {
  if (!content.startsWith('---')) return { data: {} as Record<string, string | string[]>, body: content }
  const parts = content.split('---')
  if (parts.length < 3) return { data: {} as Record<string, string | string[]>, body: content }
  const data: Record<string, string | string[]> = {}
  for (const line of parts[1].split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    let value: string | string[] = line.slice(index + 1).trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    }
    data[key] = value
  }
  return { data, body: parts.slice(2).join('---').replace(/^\r?\n/, '') }
}

function scanClaudeAgents(dir: string, scope: 'global' | 'project'): SubagentItem[] {
  if (!isDirectory(dir)) return []
  return fs.readdirSync(dir).filter((n) => n.endsWith('.md')).map((name) => {
    const filePath = path.join(dir, name)
    const content = readText(filePath)
    const fm = parseMdFrontmatter(content)
    const tools = fm.data.tools
    return {
      name: String(fm.data.name || name.slice(0, -3)),
      description: String(fm.data.description || ''),
      source: scope,
      path: filePath,
      content,
      format: 'md' as const,
      tools: Array.isArray(tools) ? tools : tools ? [String(tools)] : undefined,
    }
  })
}

function scanCodexAgents(dir: string, scope: 'global' | 'project'): SubagentItem[] {
  if (!isDirectory(dir)) return []
  return fs.readdirSync(dir).filter((n) => n.endsWith('.toml')).map((name) => {
    const filePath = path.join(dir, name)
    const content = readText(filePath)
    let parsedName = name.slice(0, -5)
    let description = ''
    try {
      const toml = parse(content) as Record<string, unknown>
      if (toml.name) parsedName = String(toml.name)
      if (toml.description) description = String(toml.description)
    } catch { /* use filename */ }
    return {
      name: parsedName,
      description,
      source: scope,
      path: filePath,
      content,
      format: 'toml' as const,
    }
  })
}

export function listSubagents(agent: string, project?: string | null): SubagentItem[] {
  const home = homeDir()
  if (agent === 'claude') {
    const globalDir = path.join(home, '.claude', 'agents')
    const projectDir = project ? path.join(project, '.claude', 'agents') : null
    return [
      ...scanClaudeAgents(globalDir, 'global'),
      ...(projectDir ? scanClaudeAgents(projectDir, 'project') : []),
    ]
  }
  const globalDir = path.join(home, '.codex', 'agents')
  const projectDir = project ? path.join(project, '.codex', 'agents') : null
  return [
    ...scanCodexAgents(globalDir, 'global'),
    ...(projectDir ? scanCodexAgents(projectDir, 'project') : []),
  ]
}
