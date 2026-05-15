import fs from 'node:fs'
import path from 'node:path'
import { homeDir, isDirectory, readText } from './fsUtils'

interface SyncRequest {
  scope: 'all' | 'global' | 'project'
  project_path?: string | null
  home_path?: string | null
  replace?: boolean
}

interface WriteAction {
  itemId: string
  target: string
  content: string
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

function itemId(type: string, name: string, source: string) {
  return `${type}:${name}:${source}`
}

function escapeTomlString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeTomlMultiline(value: string) {
  return value.replace(/"""/g, '\\"\\"\\"')
}

function codexAgentToml(agent: { name: string; description: string; tools: unknown; body: string }) {
  const tools = agent.tools
    ? `# Claude tools: ${Array.isArray(agent.tools) ? agent.tools.join(', ') : String(agent.tools)}\n`
    : ''
  return [
    `name = "${escapeTomlString(agent.name)}"`,
    `description = "${escapeTomlString(agent.description)}"`,
    `${tools}instructions = """`,
    escapeTomlMultiline(agent.body).replace(/\s+$/, ''),
    '"""',
    '',
  ].join('\n')
}

function makeItems(req: SyncRequest) {
  const home = req.home_path || homeDir()
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
      const id = itemId('Instruction', path.basename(inst.source), inst.source)
      items.push({ id, status: warnings.length ? 'check' : 'added', type: 'Instruction', name: path.basename(inst.source), source: inst.source, target: targets.instructions, notes: 'Converted to AGENTS.md', warnings })
      actions.push({ itemId: id, target: targets.instructions, content: inst.content })
    }
    for (const skill of found.skills) {
      const target = path.join(targets.skills, `${skill.name.toLowerCase().replace(/\s+/g, '-')}.md`)
      const id = itemId('Skill', skill.name, skill.source)
      items.push({ id, status: 'added', type: 'Skill', name: skill.name, source: skill.source, target, notes: 'Converted into a Codex skill', warnings: [] })
      actions.push({ itemId: id, target, content: `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n${skill.body}` })
    }
    for (const agent of found.agents) {
      const target = path.join(targets.agents, `${agent.name.toLowerCase().replace(/\s+/g, '-')}.toml`)
      const id = itemId('Subagent', agent.name, agent.source)
      items.push({ id, status: agent.tools ? 'check' : 'added', type: 'Subagent', name: agent.name, source: agent.source, target, notes: 'Added as a Codex subagent', warnings: agent.tools ? ['Claude tools metadata preserved for review'] : [] })
      actions.push({ itemId: id, target, content: codexAgentToml(agent) })
    }
    for (const command of found.commands) {
      const id = itemId('Command', command.name, command.source)
      items.push({ id, status: 'unsupported', type: 'Command', name: command.name, source: command.source, target: '', notes: 'Codex 无等价斜杠命令机制，不迁移', warnings: [] })
    }
  }
  return { items, actions }
}

function backupPath(target: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
  let candidate = `${target}.bak.${stamp}`
  let index = 1
  while (fs.existsSync(candidate)) {
    candidate = `${target}.bak.${stamp}.${index}`
    index += 1
  }
  return candidate
}

function writeActions(actions: WriteAction[], dryRun: boolean, replace = false) {
  const written: string[] = []
  const skipped: string[] = []
  const overwritten: string[] = []
  const backups: Array<{ target: string; backup: string }> = []
  const errors: string[] = []
  const itemActions = new Map<string, string>()
  for (const action of actions) {
    if (action.target.includes(`${path.sep}.claude${path.sep}`)) {
      errors.push(`BLOCKED: ${action.target} is a protected Claude source path`)
      itemActions.set(action.itemId, 'unknown')
      continue
    }
    const targetExists = fs.existsSync(action.target)
    if (targetExists && !replace) {
      skipped.push(action.target)
      itemActions.set(action.itemId, 'would_skip')
      continue
    }
    if (dryRun) {
      if (targetExists) {
        overwritten.push(action.target)
        itemActions.set(action.itemId, 'would_overwrite')
      } else {
        written.push(action.target)
        itemActions.set(action.itemId, 'would_write')
      }
      continue
    }
    fs.mkdirSync(path.dirname(action.target), { recursive: true })
    if (targetExists) {
      const backup = backupPath(action.target)
      fs.copyFileSync(action.target, backup)
      backups.push({ target: action.target, backup })
      overwritten.push(action.target)
    } else {
      written.push(action.target)
    }
    fs.writeFileSync(action.target, action.content, 'utf8')
    itemActions.set(action.itemId, targetExists ? 'would_overwrite' : 'would_write')
  }
  return { written, skipped, overwritten, backups, errors, itemActions }
}

function annotateDryRunActions(items: any[], report: ReturnType<typeof writeActions>) {
  return items.map((item) => ({
    ...item,
    dry_run_action: item.status === 'unsupported'
      ? 'skip_unsupported'
      : report.itemActions.get(item.id) ?? 'unknown',
  }))
}

function annotatePlanConflicts(items: any[], replace = false) {
  return items.map((item) => {
    if (item.status === 'unsupported' || !item.target || replace || !fs.existsSync(item.target)) return item
    return { ...item, status: 'conflict', notes: '目标已存在，默认跳过；开启覆盖模式后将先备份再覆盖' }
  })
}

export function syncScan(req: SyncRequest) {
  return { items: makeItems(req).items.map(({ id, status, notes, warnings, ...item }) => item) }
}

export function syncPlan(req: SyncRequest) {
  const { items: rawItems } = makeItems(req)
  const items = annotatePlanConflicts(rawItems, req.replace)
  const added = items.filter((item) => item.status === 'added').length
  const check = items.filter((item) => item.status === 'check').length
  const conflicts = items.filter((item) => item.status === 'conflict').length
  const unsupported = items.filter((item) => item.status === 'unsupported').length
  return { items, stats: { migratable: added + check, needs_conversion: check, conflicts, unsupported } }
}

export function syncDryRun(req: SyncRequest) {
  const { items, actions } = makeItems(req)
  const report = writeActions(actions, true, req.replace)
  return { dry_run: true, items: annotateDryRunActions(items, report), would_write: report.written, would_skip: report.skipped, would_overwrite: report.overwritten }
}

export function syncExecute(req: SyncRequest) {
  const { items, actions } = makeItems(req)
  const report = writeActions(actions, false, req.replace)
  return { dry_run: false, items: annotateDryRunActions(items, report), written: report.written, skipped: report.skipped, overwritten: report.overwritten, backups: report.backups, errors: report.errors }
}
