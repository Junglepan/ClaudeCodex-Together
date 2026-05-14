import fs from 'node:fs'
import path from 'node:path'
import { homeDir, isDirectory, readText } from './fsUtils'

interface SyncRequest {
  scope: 'all' | 'global' | 'project'
  project_path?: string | null
  replace?: boolean
}

interface WriteAction {
  target: string
  content: string
}

const unsupportedHooks: Record<string, string> = {
  SessionStart: 'Codex 无对应事件，无法迁移。建议将相关行为记录在 AGENTS.md 中手动说明',
  Stop: 'Codex 无对应事件，无法迁移。建议将相关行为记录在 AGENTS.md 中手动说明',
  Notification: 'Codex 无对应事件，无法迁移',
}

function parseFrontmatter(content: string) {
  if (!content.startsWith('---')) return { data: {}, body: content }
  const parts = content.split('---')
  if (parts.length < 3) return { data: {}, body: content }
  const data: Record<string, string | string[]> = {}
  for (const line of parts[1].split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    let value: string | string[] = line.slice(index + 1).trim()
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    }
    data[key] = value
  }
  return { data, body: parts.slice(2).join('---').replace(/^\r?\n/, '') }
}

function scan(scopeRoot: string, isGlobal: boolean) {
  const instructionsPath = isGlobal ? path.join(scopeRoot, '.claude', 'CLAUDE.md') : path.join(scopeRoot, 'CLAUDE.md')
  const claudeRoot = isGlobal ? path.join(scopeRoot, '.claude') : path.join(scopeRoot, '.claude')
  const instructions = fs.existsSync(instructionsPath) ? [{ source: instructionsPath, content: readText(instructionsPath) }] : []
  const skillsDir = path.join(claudeRoot, 'skills')
  const skills = isDirectory(skillsDir) ? fs.readdirSync(skillsDir).flatMap((name) => {
    const skillPath = path.join(skillsDir, name, 'SKILL.md')
    if (!fs.existsSync(skillPath)) return []
    const content = readText(skillPath)
    const fm = parseFrontmatter(content)
    return [{ name: String(fm.data.name ?? name), description: String(fm.data.description ?? ''), source: skillPath, content, body: fm.body }]
  }) : []
  const agentsDir = path.join(claudeRoot, 'agents')
  const agents = isDirectory(agentsDir) ? fs.readdirSync(agentsDir).filter((name) => name.endsWith('.md')).map((name) => {
    const agentPath = path.join(agentsDir, name)
    const content = readText(agentPath)
    const fm = parseFrontmatter(content)
    return { name: String(fm.data.name ?? name.slice(0, -3)), description: String(fm.data.description ?? ''), tools: fm.data.tools, source: agentPath, content, body: fm.body }
  }) : []
  const commandsDir = path.join(claudeRoot, 'commands')
  const commands = isDirectory(commandsDir) ? fs.readdirSync(commandsDir).filter((name) => name.endsWith('.md')).map((name) => ({ name: name.slice(0, -3), source: path.join(commandsDir, name) })) : []
  return { instructions, skills, agents, commands }
}

function targetDirs(home: string, project: string | null, isGlobal: boolean) {
  const root = isGlobal ? home : project || process.cwd()
  return {
    instructions: isGlobal ? path.join(home, '.codex', 'AGENTS.md') : path.join(root, 'AGENTS.md'),
    skills: path.join(root, '.codex', 'skills'),
    agents: path.join(root, '.codex', 'agents'),
  }
}

function makeItems(req: SyncRequest) {
  const home = homeDir()
  const project = req.project_path || null
  const items: any[] = []
  const actions: WriteAction[] = []
  const scopes = [
    ...(req.scope === 'all' || req.scope === 'global' ? [{ root: home, isGlobal: true }] : []),
    ...(project && (req.scope === 'all' || req.scope === 'project') ? [{ root: project, isGlobal: false }] : []),
  ]
  for (const scope of scopes) {
    const found = scan(scope.root, scope.isGlobal)
    const targets = targetDirs(home, project, scope.isGlobal)
    for (const inst of found.instructions) {
      const warnings = /\/\w+/.test(inst.content) ? ['Contains Claude slash command references'] : []
      items.push({ status: warnings.length ? 'check' : 'added', type: 'Instruction', name: path.basename(inst.source), source: inst.source, target: targets.instructions, notes: 'Converted to AGENTS.md', warnings })
      actions.push({ target: targets.instructions, content: inst.content })
    }
    for (const skill of found.skills) {
      const target = path.join(targets.skills, `${skill.name.toLowerCase().replace(/\s+/g, '-')}.md`)
      items.push({ status: 'added', type: 'Skill', name: skill.name, source: skill.source, target, notes: 'Converted into a Codex skill', warnings: [] })
      actions.push({ target, content: `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n${skill.body}` })
    }
    for (const agent of found.agents) {
      const target = path.join(targets.agents, `${agent.name.toLowerCase().replace(/\s+/g, '-')}.md`)
      const toolsNote = agent.tools ? `# tools (Claude): ${Array.isArray(agent.tools) ? agent.tools.join(', ') : agent.tools}\n` : ''
      items.push({ status: agent.tools ? 'check' : 'added', type: 'Subagent', name: agent.name, source: agent.source, target, notes: 'Added as a Codex subagent', warnings: [] })
      actions.push({ target, content: `---\nname: ${agent.name}\ndescription: ${agent.description}\n---\n${toolsNote}${agent.body}` })
    }
    for (const command of found.commands) {
      items.push({ status: 'unsupported', type: 'Command', name: command.name, source: command.source, target: '', notes: 'Codex 无等价斜杠命令机制，不迁移', warnings: [] })
    }
  }
  return { items, actions }
}

function writeActions(actions: WriteAction[], dryRun: boolean, replace = false) {
  const written: string[] = []
  const skipped: string[] = []
  const errors: string[] = []
  for (const action of actions) {
    if (action.target.includes(`${path.sep}.claude${path.sep}`)) {
      errors.push(`BLOCKED: ${action.target} is a protected Claude source path`)
      continue
    }
    if (fs.existsSync(action.target) && !replace) {
      skipped.push(action.target)
      continue
    }
    if (dryRun) {
      written.push(`[dry-run] ${action.target}`)
      continue
    }
    fs.mkdirSync(path.dirname(action.target), { recursive: true })
    fs.writeFileSync(action.target, action.content, 'utf8')
    written.push(action.target)
  }
  return { written, skipped, errors }
}

export function syncScan(req: SyncRequest) {
  return { items: makeItems(req).items.map(({ status, notes, warnings, ...item }) => item) }
}

export function syncPlan(req: SyncRequest) {
  const { items } = makeItems(req)
  const added = items.filter((item) => item.status === 'added').length
  const check = items.filter((item) => item.status === 'check').length
  const unsupported = items.filter((item) => item.status === 'unsupported').length
  return { items, stats: { migratable: added + check, needs_conversion: check, conflicts: 0, unsupported } }
}

export function syncDryRun(req: SyncRequest) {
  const { items, actions } = makeItems(req)
  const report = writeActions(actions, true, req.replace)
  return { dry_run: true, items, would_write: report.written, would_skip: report.skipped }
}

export function syncExecute(req: SyncRequest) {
  const { items, actions } = makeItems(req)
  const report = writeActions(actions, false, req.replace)
  return { dry_run: false, items, written: report.written, skipped: report.skipped, errors: report.errors }
}
