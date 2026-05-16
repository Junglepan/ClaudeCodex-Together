import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parse as parseToml } from 'smol-toml'
import { homeDir, isDirectory, isFile, readText, readJsonSafe } from './fsUtils'

// ── Types ──────────────────────────────────────────────────────────────────

interface SyncRequest {
  scope: 'all' | 'global' | 'project'
  project_path?: string | null
  home_path?: string | null
  replace?: boolean
  item_ids?: string[] | null
}

interface WriteAction {
  itemId: string
  target: string
  content: string
  copyFrom?: string
}

interface StructuredWarnings {
  removed_lines: string[]
  tool_comments: string[]
  check_lines: Array<{ line: number; content: string }>
  manual_notes: string[]
}

// ── Constants (aligned with official migrate-to-codex) ─────────────────────

const CODEX_SKILLS_ROOT = path.join('.agents', 'skills')
const CODEX_AGENTS_ROOT = path.join('.codex', 'agents')
const CODEX_CONFIG_PATH = path.join('.codex', 'config.toml')
const CODEX_HOOKS_PATH = path.join('.codex', 'hooks.json')

const CLAUDE_ONLY_INSTRUCTION_MARKERS = [
  '/hooks',
  '.claude/agents/',
  '.claude/settings',
  'Subagent',
  'subagent',
  'permissionMode',
  'ExitPlanMode',
]

const MODEL_PREFIX_MAPPINGS: Array<{
  sourcePrefix: string
  targetModel: string
  effortMapping: Record<string, string>
}> = [
  {
    sourcePrefix: 'claude-opus',
    targetModel: 'gpt-5.4',
    effortMapping: { low: 'low', medium: 'medium', high: 'high', max: 'xhigh' },
  },
  {
    sourcePrefix: 'claude-sonnet',
    targetModel: 'gpt-5.4-mini',
    effortMapping: { low: 'medium', medium: 'high', high: 'xhigh', max: 'xhigh' },
  },
  {
    sourcePrefix: 'claude-haiku',
    targetModel: 'gpt-5.4-mini',
    effortMapping: { low: 'low', medium: 'medium', high: 'high', max: 'xhigh' },
  },
]

const PERMISSION_MODE_MAPPINGS: Record<string, string> = {
  acceptEdits: 'workspace-write',
  readOnly: 'read-only',
}

const SKILL_SUPPORT_DIRS = ['scripts', 'references', 'assets']

const CLAUDE_SLASH_COMMANDS = /^\/(?:compact|clear|help|init|review|cost|doctor|login|logout|bug|config|context|hooks|ide|listen|mcp|memory|model|plan|pr-comments|resume|terminal-setup|vim|status)\b/
const TOOL_NAME_PATTERN = /\b(Read|Write|Edit|Bash|Grep|Glob|WebSearch|WebFetch|TodoRead|TodoWrite|Agent|NotebookEdit)\b/g

const CODEX_HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'SessionStart', 'UserPromptSubmit', 'Stop']
const CODEX_HOOK_MATCHER_EVENTS = new Set(['PreToolUse', 'PostToolUse', 'SessionStart'])

const CLAUDE_SETTINGS_JSON_RELATIVE = [
  path.join('.claude', 'settings.json'),
  path.join('.claude', 'settings.local.json'),
]

const CLAUDE_MCP_JSON_RELATIVE = ['.mcp.json', '.claude.json']

const CLAUDE_PLUGIN_MANUAL_PATHS = [
  { relative: path.join('.claude', 'plugins'), label: 'Claude Code plugins' },
  { relative: path.join('.claude', 'plugin-marketplaces.json'), label: 'Claude Code plugin marketplace registry' },
  { relative: path.join('.claude-plugin', 'marketplace.json'), label: 'Claude Code plugin marketplace' },
]

// ── Frontmatter parsing ────────────────────────────────────────────────────

function parseFrontmatter(content: string) {
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
      value = value.slice(1, -1).split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    }
    data[key] = value
  }
  return { data, body: parts.slice(2).join('---').replace(/^\r?\n/, '') }
}

function formatFrontmatter(data: Record<string, string>, body: string) {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`)
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`
}

// ── Model / effort / permission mapping ────────────────────────────────────

function mapModelName(model: string): string {
  for (const m of MODEL_PREFIX_MAPPINGS) {
    if (model.startsWith(m.sourcePrefix)) return m.targetModel
  }
  return model
}

function mapModelEffort(model: string | null | undefined, effort: string): string {
  if (!model) return effort
  for (const m of MODEL_PREFIX_MAPPINGS) {
    if (model.startsWith(m.sourcePrefix)) return m.effortMapping[effort] ?? effort
  }
  return effort
}

function mapPermissionMode(mode: string | null | undefined): string | null {
  if (!mode) return null
  return PERMISSION_MODE_MAPPINGS[mode] ?? null
}

// ── Content analysis ───────────────────────────────────────────────────────

function analyzeContent(content: string): StructuredWarnings {
  const lines = content.split('\n')
  const removed: string[] = []
  const toolComments: string[] = []
  const checkLines: Array<{ line: number; content: string }> = []
  const toolsFound = new Set<string>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (CLAUDE_SLASH_COMMANDS.test(line.trim())) {
      removed.push(line.trim())
    }
    for (const match of line.matchAll(TOOL_NAME_PATTERN)) {
      toolsFound.add(match[1])
      checkLines.push({ line: i + 1, content: line.trim() })
    }
  }

  return {
    removed_lines: removed,
    tool_comments: [...toolsFound],
    check_lines: checkLines.slice(0, 10),
    manual_notes: [],
  }
}

function shouldSymlinkInstructions(content: string): boolean {
  return !CLAUDE_ONLY_INSTRUCTION_MARKERS.some((marker) => content.includes(marker))
}

// ── TOML helpers ───────────────────────────────────────────────────────────

function escapeTomlString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeTomlMultiline(value: string) {
  return value.replace(/"""/g, '\\"\\"\\"')
}

function renderTomlKeyValue(key: string, value: unknown, indent = ''): string {
  if (typeof value === 'string') return `${indent}${key} = "${escapeTomlString(value)}"\n`
  if (typeof value === 'boolean') return `${indent}${key} = ${value}\n`
  if (typeof value === 'number') return `${indent}${key} = ${value}\n`
  if (Array.isArray(value)) {
    const items = value.map((v) => typeof v === 'string' ? `"${escapeTomlString(v)}"` : String(v))
    return `${indent}${key} = [${items.join(', ')}]\n`
  }
  return ''
}

function renderTomlTable(tableName: string, obj: Record<string, unknown>): string {
  let out = `[${tableName}]\n`
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      out += `\n[${tableName}.${k}]\n`
      for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
        out += renderTomlKeyValue(sk, sv)
      }
    } else {
      out += renderTomlKeyValue(k, v)
    }
  }
  return out
}

// ── Skill support file discovery ───────────────────────────────────────────

function collectSkillSupportFiles(skillDir: string): Array<{ source: string; relative: string }> {
  const files: Array<{ source: string; relative: string }> = []
  for (const dirName of SKILL_SUPPORT_DIRS) {
    const supportDir = path.join(skillDir, dirName)
    if (!isDirectory(supportDir)) continue
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(fullPath); continue }
        if (entry.isFile()) {
          const relative = path.relative(skillDir, fullPath)
          files.push({ source: fullPath, relative })
        }
      }
    }
    walk(supportDir)
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative))
}

// ── Scan source files ──────────────────────────────────────────────────────

function scan(scopeRoot: string, isGlobal: boolean) {
  const instructionsPath = isGlobal ? path.join(scopeRoot, '.claude', 'CLAUDE.md') : path.join(scopeRoot, 'CLAUDE.md')
  const claudeRoot = path.join(scopeRoot, '.claude')
  const instructions = fs.existsSync(instructionsPath) ? [{ source: instructionsPath, content: readText(instructionsPath) }] : []

  const skillsDir = path.join(claudeRoot, 'skills')
  const skills = isDirectory(skillsDir) ? fs.readdirSync(skillsDir).flatMap((name) => {
    const skillPath = path.join(skillsDir, name, 'SKILL.md')
    if (!fs.existsSync(skillPath)) return []
    const content = readText(skillPath)
    const fm = parseFrontmatter(content)
    const allowedTools = typeof fm.data['allowed-tools'] === 'string'
      ? fm.data['allowed-tools'].split(',').map((s) => s.trim()).filter(Boolean)
      : Array.isArray(fm.data['allowed-tools']) ? fm.data['allowed-tools'] : []
    const skillRoot = path.join(skillsDir, name)
    const supportFiles = collectSkillSupportFiles(skillRoot)
    return [{
      name: String(fm.data.name ?? name),
      description: String(fm.data.description ?? ''),
      source: skillPath,
      content,
      body: fm.body,
      allowedTools,
      skillDirName: name,
      supportFiles,
    }]
  }) : []

  const agentsDir = path.join(claudeRoot, 'agents')
  const agents = isDirectory(agentsDir) ? fs.readdirSync(agentsDir).filter((n) => n.endsWith('.md') && n !== 'README.md').map((name) => {
    const agentPath = path.join(agentsDir, name)
    const content = readText(agentPath)
    const fm = parseFrontmatter(content)
    return {
      name: String(fm.data.name ?? name.slice(0, -3)),
      description: String(fm.data.description ?? ''),
      model: typeof fm.data.model === 'string' ? fm.data.model : null,
      effort: typeof fm.data.effort === 'string' ? fm.data.effort : null,
      permissionMode: typeof fm.data.permissionMode === 'string' ? fm.data.permissionMode : null,
      tools: fm.data.tools,
      disallowedTools: fm.data.disallowedTools,
      skills: fm.data.skills,
      source: agentPath,
      content,
      body: fm.body,
      stem: name.slice(0, -3),
    }
  }) : []

  const commandsDir = path.join(claudeRoot, 'commands')
  const commands = isDirectory(commandsDir) ? fs.readdirSync(commandsDir).filter((n) => n.endsWith('.md')).map((name) => {
    const cmdPath = path.join(commandsDir, name)
    const content = readText(cmdPath)
    const fm = parseFrontmatter(content)
    return { name: name.slice(0, -3), source: cmdPath, content, body: fm.body, description: typeof fm.data.description === 'string' ? fm.data.description : null }
  }) : []

  const hooks = readClaudeHooks(scopeRoot)
  const mcpServers = readClaudeMcpServers(scopeRoot)
  const settings = loadScopeSettings(scopeRoot)
  const plugins = scanPlugins(scopeRoot)

  return { instructions, skills, agents, commands, hooks, mcpServers, settings, plugins }
}

// ── Hooks ──────────────────────────────────────────────────────────────────

interface HookCommand {
  command: string
  timeout?: number
  statusMessage?: string
}

interface HookMatcherGroup {
  eventName: string
  matcher: string | null
  hooks: HookCommand[]
}

interface ClaudeHooks {
  matcherGroups: HookMatcherGroup[]
  unsupportedFields: string[]
}

function readClaudeHooks(scopeRoot: string): ClaudeHooks {
  const allGroups: HookMatcherGroup[] = []
  const unsupported: string[] = []

  for (const rel of CLAUDE_SETTINGS_JSON_RELATIVE) {
    const filePath = path.join(scopeRoot, rel)
    if (!fs.existsSync(filePath)) continue
    const settings = readJsonSafe(filePath)
    const hooksConfig = settings.hooks as Record<string, unknown> | undefined
    if (!hooksConfig || typeof hooksConfig !== 'object') continue

    for (const [eventName, groupsValue] of Object.entries(hooksConfig)) {
      if (!CODEX_HOOK_EVENTS.includes(eventName)) {
        unsupported.push(`hooks.${eventName}`)
        continue
      }
      if (!Array.isArray(groupsValue)) continue
      for (const groupConfig of groupsValue) {
        if (!groupConfig || typeof groupConfig !== 'object') continue
        const gc = groupConfig as Record<string, unknown>
        let matcher = typeof gc.matcher === 'string' ? gc.matcher : null
        if (matcher && !CODEX_HOOK_MATCHER_EVENTS.has(eventName)) {
          unsupported.push(`hooks.${eventName}.matcher`)
          matcher = null
        }
        if ('if' in gc) unsupported.push(`hooks.${eventName}.if`)

        const hookCommands: HookCommand[] = []
        const hooksArr = Array.isArray(gc.hooks) ? gc.hooks : []
        for (const hookConfig of hooksArr) {
          if (!hookConfig || typeof hookConfig !== 'object') continue
          const hc = hookConfig as Record<string, unknown>
          const hookType = typeof hc.type === 'string' ? hc.type : 'command'
          if (hookType !== 'command') { unsupported.push(`hooks.${eventName}.hooks[].type:${hookType}`); continue }
          if (hc.async) { unsupported.push(`hooks.${eventName}.hooks[].async`); continue }
          const command = typeof hc.command === 'string' ? hc.command : null
          if (!command?.trim()) continue
          const timeout = typeof hc.timeout === 'number' ? hc.timeout : (typeof hc.timeoutSec === 'number' ? hc.timeoutSec : undefined)
          const statusMessage = typeof hc.statusMessage === 'string' ? hc.statusMessage : undefined
          hookCommands.push({ command, timeout, statusMessage })
        }
        if (hookCommands.length > 0) {
          allGroups.push({ eventName, matcher, hooks: hookCommands })
        }
      }
    }
  }

  return { matcherGroups: allGroups, unsupportedFields: [...new Set(unsupported)].sort() }
}

function renderCodexHooksJson(hooks: ClaudeHooks): string {
  const payload: Record<string, unknown[]> = {}
  for (const group of hooks.matcherGroups) {
    const entry: Record<string, unknown> = {
      hooks: group.hooks.map((h) => {
        const obj: Record<string, unknown> = { type: 'command', command: h.command }
        if (h.timeout != null) obj.timeout = h.timeout
        if (h.statusMessage) obj.statusMessage = h.statusMessage
        return obj
      }),
    }
    if (group.matcher != null) entry.matcher = group.matcher
    if (!payload[group.eventName]) payload[group.eventName] = []
    payload[group.eventName].push(entry)
  }
  return JSON.stringify({ hooks: payload }, null, 2) + '\n'
}

// ── MCP servers ────────────────────────────────────────────────────────────

interface McpServerEntry {
  name: string
  config: Record<string, unknown>
}

function readClaudeMcpServers(scopeRoot: string): McpServerEntry[] {
  const servers: McpServerEntry[] = []
  for (const rel of CLAUDE_MCP_JSON_RELATIVE) {
    const filePath = path.join(scopeRoot, rel)
    if (!fs.existsSync(filePath)) continue
    const data = readJsonSafe(filePath)
    const mcpServers = data.mcpServers as Record<string, unknown> | undefined
    if (!mcpServers || typeof mcpServers !== 'object') continue
    for (const [name, config] of Object.entries(mcpServers)) {
      if (config && typeof config === 'object') {
        servers.push({ name, config: config as Record<string, unknown> })
      }
    }
  }
  // Also read from settings.json mcpServers
  for (const rel of CLAUDE_SETTINGS_JSON_RELATIVE) {
    const filePath = path.join(scopeRoot, rel)
    if (!fs.existsSync(filePath)) continue
    const data = readJsonSafe(filePath)
    const mcpServers = data.mcpServers as Record<string, unknown> | undefined
    if (!mcpServers || typeof mcpServers !== 'object') continue
    for (const [name, config] of Object.entries(mcpServers)) {
      if (config && typeof config === 'object' && !servers.some((s) => s.name === name)) {
        servers.push({ name, config: config as Record<string, unknown> })
      }
    }
  }
  return servers
}

function mcpServerToToml(serverName: string, config: Record<string, unknown>): Record<string, unknown> {
  const table: Record<string, unknown> = {}
  if (config.enabled === false || config.disabled === true) table.enabled = false
  if (typeof config.url === 'string') table.url = config.url
  if (typeof config.command === 'string') table.command = config.command
  if (Array.isArray(config.args)) table.args = config.args.map(String)

  if (config.headers && typeof config.headers === 'object') {
    const headers = config.headers as Record<string, unknown>
    const staticHeaders: Record<string, string> = {}
    const envHeaders: Record<string, string> = {}
    for (const [key, value] of Object.entries(headers)) {
      const headerValue = String(value)
      const bearerMatch = headerValue.match(/^Bearer\s+\$\{([A-Za-z_]\w*)(?::-[^}]*)?\}$/)
      if (key.toLowerCase() === 'authorization' && bearerMatch) {
        table.bearer_token_env_var = bearerMatch[1]
        continue
      }
      const envMatch = headerValue.match(/^\$\{([A-Za-z_]\w*)(?::-[^}]*)?\}$/)
      if (envMatch) { envHeaders[key] = envMatch[1]; continue }
      staticHeaders[key] = headerValue
    }
    if (Object.keys(staticHeaders).length > 0) table.http_headers = staticHeaders
    if (Object.keys(envHeaders).length > 0) table.env_http_headers = envHeaders
  }

  if (config.env && typeof config.env === 'object') {
    const env = config.env as Record<string, unknown>
    const staticEnv: Record<string, string> = {}
    const envVars: string[] = []
    for (const [key, value] of Object.entries(env)) {
      const envValue = String(value)
      const envMatch = envValue.match(/^\$\{([A-Za-z_]\w*)(?::-[^}]*)?\}$/)
      if (envMatch && envMatch[1] === key) { envVars.push(key); continue }
      staticEnv[key] = envValue
    }
    if (envVars.length > 0) table.env_vars = envVars
    if (Object.keys(staticEnv).length > 0) table.env = staticEnv
  }

  return table
}

// ── Settings ───────────────────────────────────────────────────────────────

function loadScopeSettings(scopeRoot: string): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const rel of CLAUDE_SETTINGS_JSON_RELATIVE) {
    const filePath = path.join(scopeRoot, rel)
    if (!fs.existsSync(filePath)) continue
    Object.assign(merged, readJsonSafe(filePath))
  }
  return merged
}

function renderCodexConfigToml(
  settings: Record<string, unknown>,
  mcpServers: McpServerEntry[],
  hasHooks: boolean,
): string {
  const lines: string[] = []
  lines.push('personality = "friendly"')
  lines.push('')

  const model = typeof settings.model === 'string' ? settings.model : null
  if (model) lines.push(`model = "${escapeTomlString(mapModelName(model))}"`)

  const permMode = typeof settings.permissionMode === 'string' ? settings.permissionMode : null
  const sandboxMode = mapPermissionMode(permMode)
  if (sandboxMode) lines.push(`sandbox_mode = "${escapeTomlString(sandboxMode)}"`)

  if (model || sandboxMode) lines.push('')

  if (hasHooks) {
    lines.push('[features]')
    lines.push('codex_hooks = true')
    lines.push('')
  }

  if (mcpServers.length > 0) {
    const enabledServers = Array.isArray(settings.enabledMcpjsonServers) ? settings.enabledMcpjsonServers.map(String) : []
    const disabledServers = new Set(Array.isArray(settings.disabledMcpjsonServers) ? settings.disabledMcpjsonServers.map(String) : [])

    for (const server of mcpServers) {
      const table = mcpServerToToml(server.name, server.config)
      if (enabledServers.length > 0 && !enabledServers.includes(server.name)) table.enabled = false
      if (disabledServers.has(server.name)) table.enabled = false
      lines.push(`[mcp_servers.${server.name}]`)
      for (const [k, v] of Object.entries(table)) {
        if (v != null && typeof v === 'object' && !Array.isArray(v)) {
          lines.push(`[mcp_servers.${server.name}.${k}]`)
          for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
            lines.push(renderTomlKeyValue(sk, sv).trimEnd())
          }
        } else {
          lines.push(renderTomlKeyValue(k, v).trimEnd())
        }
      }
      lines.push('')
    }
  }

  return lines.join('\n') + '\n'
}

// ── Plugins ────────────────────────────────────────────────────────────────

function scanPlugins(scopeRoot: string) {
  const found: Array<{ relative: string; label: string }> = []
  for (const p of CLAUDE_PLUGIN_MANUAL_PATHS) {
    if (fs.existsSync(path.join(scopeRoot, p.relative))) {
      found.push(p)
    }
  }
  return found
}

// ── Agent TOML rendering (aligned with official) ───────────────────────────

function renderAgentToml(agent: {
  name: string
  description: string
  model: string | null
  effort: string | null
  permissionMode: string | null
  tools: string | string[] | undefined
  disallowedTools: string | string[] | undefined
  skills: string | string[] | undefined
  body: string
}): string {
  const lines: string[] = []
  lines.push(`name = "${escapeTomlString(agent.name)}"`)
  lines.push(`description = "${escapeTomlString(agent.description)}"`)

  if (agent.model) {
    lines.push(`model = "${escapeTomlString(mapModelName(agent.model))}"`)
  }
  if (agent.effort) {
    const mappedEffort = mapModelEffort(agent.model, agent.effort)
    lines.push(`model_reasoning_effort = "${escapeTomlString(mappedEffort)}"`)
  }
  const sandboxMode = mapPermissionMode(agent.permissionMode)
  if (sandboxMode) {
    lines.push(`sandbox_mode = "${escapeTomlString(sandboxMode)}"`)
  }

  const bodyParts: string[] = [agent.body.trimEnd()]
  const manualNotes: string[] = []

  if (agent.permissionMode && !sandboxMode) {
    manualNotes.push(
      `Claude \`permissionMode: ${agent.permissionMode}\` has no direct Codex mapping. ` +
      'Manually choose `sandbox_mode`, `[permissions]`, MCP tool filters, or app tool filters before relying on this agent.'
    )
  }

  const skillsList = toStringArray(agent.skills)
  if (skillsList.length > 0) {
    bodyParts.push(
      '\n\n## Skills\n\n' +
      "You're allowed to use these skills when working on this task:\n\n" +
      skillsList.map((s) => `- $${s}`).join('\n')
    )
    manualNotes.push('Claude `skills` preload semantics were preserved as prompt guidance. Verify this agent still discovers the intended skills at runtime.')
  }

  const toolsList = toStringArray(agent.tools)
  const disallowedList = toStringArray(agent.disallowedTools)
  if (toolsList.length > 0 || disallowedList.length > 0) {
    const toolLines = ['\n\n## Tools\n', 'Claude tool allow/deny lists were preserved as prompt guidance, not Codex permissions.']
    if (toolsList.length > 0) {
      toolLines.push('', "You're allowed to use these tools:", '', ...toolsList.map((t) => `- ${t}`))
    }
    if (disallowedList.length > 0) {
      toolLines.push('', "Don't use these tools:", '', ...disallowedList.map((t) => `- ${t}`))
    }
    bodyParts.push(toolLines.join('\n'))
    manualNotes.push('Rebuild Claude `tools` / `disallowedTools` intent with Codex sandbox, MCP tool filters, or app tool filters if you need hard enforcement.')
  }

  if (manualNotes.length > 0) {
    bodyParts.push('\n\n## MANUAL MIGRATION REQUIRED\n\n' + manualNotes.join('\n\n'))
  }

  const fullBody = bodyParts.join('')
  lines.push(`developer_instructions = """`)
  lines.push(escapeTomlMultiline(fullBody).replace(/\s+$/, ''))
  lines.push('"""')
  lines.push('')

  return lines.join('\n')
}

function toStringArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

// ── Command → Skill conversion (aligned with official) ─────────────────────

function renderCommandAsSkill(cmd: { name: string; description: string | null; body: string }): string {
  const skillName = `source-command-${cmd.name}`
  const desc = cmd.description || `Run the migrated source command \`${cmd.name}\`.`
  const caveats: string[] = []

  if (/\$(?:ARGUMENTS|\d+)\b/.test(cmd.body)) {
    caveats.push('Provider argument placeholders like `$ARGUMENTS` or `$1` were preserved as text; rewrite them into natural-language instructions for Codex.')
  }
  if (cmd.body.includes('{{') && cmd.body.includes('}}')) {
    caveats.push('Provider template variables like `{{name}}` were preserved as text; rewrite them into natural-language instructions for Codex.')
  }
  if (/!\s*`/.test(cmd.body)) {
    caveats.push('Provider shell-output interpolation was preserved as text; replace it with explicit Codex instructions to run the command when needed.')
  }
  if (/(?:^|\s)@[\w./~:-]+/.test(cmd.body)) {
    caveats.push('Provider automatic file-reference expansion was preserved as text; verify Codex should read those files explicitly.')
  }

  const manualNotes = [
    `Migrated from source command \`${cmd.name}\` into a Codex skill. ` +
    `Invoke it as \`$${skillName}\` and manually rewrite any slash-command behavior that depended on provider-specific runtime expansion.`,
    ...caveats,
  ]

  const templateBody = cmd.body.trim() || 'No command template body was found.'
  const body =
    `# ${skillName}\n\n` +
    `Use this skill when the user asks to run the migrated source command \`${cmd.name}\`.\n\n` +
    `## Command Template\n\n${templateBody}\n\n` +
    `## MANUAL MIGRATION REQUIRED\n\n${manualNotes.join('\n\n')}\n`

  return formatFrontmatter({ name: skillName, description: desc }, body)
}

// ── Target path helpers ────────────────────────────────────────────────────

function targetRoot(home: string, project: string | null, isGlobal: boolean) {
  return isGlobal ? home : (project || process.cwd())
}

function itemId(type: string, name: string, source: string) {
  return `${type}:${name}:${source}`
}

// ── Core: build items + actions ────────────────────────────────────────────

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
    const root = targetRoot(home, project, scope.isGlobal)

    // ── Instructions ──
    for (const inst of found.instructions) {
      const analysis = analyzeContent(inst.content)
      const isNeutral = shouldSymlinkInstructions(inst.content)
      const hasIssues = analysis.removed_lines.length > 0 || analysis.check_lines.length > 0
      const warnings: string[] = []
      if (!isNeutral) {
        warnings.push('检测到 Claude 专有内容标记，建议手动审查后再同步')
        analysis.manual_notes.push('Content contains Claude-only markers (' + CLAUDE_ONLY_INSTRUCTION_MARKERS.filter((m) => inst.content.includes(m)).join(', ') + '). Review before using with Codex.')
      }
      if (analysis.removed_lines.length > 0) warnings.push(`检测到 ${analysis.removed_lines.length} 个 Claude 斜杠命令引用`)
      if (analysis.check_lines.length > 0) warnings.push(`检测到 ${analysis.tool_comments.length} 个工具名引用，需人工确认`)

      const targetPath = scope.isGlobal
        ? path.join(home, '.codex', 'AGENTS.md')
        : path.join(root, 'AGENTS.md')
      const id = itemId('Instruction', path.basename(inst.source), inst.source)
      const notes = isNeutral ? '内容中立，可直接复制为 AGENTS.md' : '包含 Claude 专有标记，建议手动审查'
      items.push({ id, status: hasIssues || !isNeutral ? 'check' : 'added', type: 'Instruction', name: path.basename(inst.source), source: inst.source, target: targetPath, notes, warnings, structured_warnings: analysis })
      actions.push({ itemId: id, target: targetPath, content: inst.content })
    }

    // ── Skills → .agents/skills/ ──
    for (const skill of found.skills) {
      const skillDir = skill.skillDirName.toLowerCase().replace(/\s+/g, '-')
      const target = path.join(root, CODEX_SKILLS_ROOT, skillDir, 'SKILL.md')
      const analysis = analyzeContent(skill.body)
      const warnings: string[] = []
      const manualNotes: string[] = []

      if (skill.allowedTools.length > 0) {
        warnings.push(`Claude allowed-tools 已转为提示引导：${skill.allowedTools.join(', ')}`)
        manualNotes.push(
          "Claude `allowed-tools` was preserved as prompt guidance, not a Codex permission boundary.\n\n" +
          "You're allowed to use these tools:\n\n" +
          skill.allowedTools.map((t) => `- ${t}`).join('\n')
        )
      }
      if (analysis.check_lines.length > 0) warnings.push(`检测到 ${analysis.tool_comments.length} 个工具名引用`)

      let convertedBody = skill.body
      if (manualNotes.length > 0) {
        convertedBody = convertedBody.trimEnd() + '\n\n## MANUAL MIGRATION REQUIRED\n\n' + manualNotes.join('\n\n') + '\n'
      }
      const convertedContent = formatFrontmatter({ name: skill.name, description: skill.description }, convertedBody)

      if (skill.supportFiles.length > 0) {
        warnings.push(`包含 ${skill.supportFiles.length} 个辅助文件（${[...new Set(skill.supportFiles.map((f) => f.relative.split(path.sep)[0]))].join('、')}）`)
      }

      analysis.manual_notes = manualNotes
      const id = itemId('Skill', skill.name, skill.source)
      items.push({ id, status: warnings.length > 0 ? 'check' : 'added', type: 'Skill', name: skill.name, source: skill.source, target, notes: '转换为 Codex skill（.agents/skills/）', warnings, structured_warnings: analysis })
      actions.push({ itemId: id, target, content: convertedContent })
      const targetSkillDir = path.join(root, CODEX_SKILLS_ROOT, skillDir)
      for (const sf of skill.supportFiles) {
        actions.push({ itemId: id, target: path.join(targetSkillDir, sf.relative), content: '', copyFrom: sf.source })
      }
    }

    // ── Agents → .codex/agents/*.toml ──
    for (const agent of found.agents) {
      const target = path.join(root, CODEX_AGENTS_ROOT, `${agent.stem.toLowerCase().replace(/\s+/g, '-')}.toml`)
      const analysis = analyzeContent(agent.body)
      const warnings: string[] = []

      if (agent.model) warnings.push(`模型映射：${agent.model} → ${mapModelName(agent.model)}`)
      if (agent.effort) warnings.push(`effort 映射：${agent.effort} → ${mapModelEffort(agent.model, agent.effort)}`)
      if (agent.permissionMode) {
        const mapped = mapPermissionMode(agent.permissionMode)
        if (mapped) warnings.push(`权限模式映射：${agent.permissionMode} → ${mapped}`)
        else warnings.push(`权限模式 ${agent.permissionMode} 无直接映射，需手动配置`)
      }
      const toolsList = toStringArray(agent.tools)
      const disallowedList = toStringArray(agent.disallowedTools)
      if (toolsList.length > 0) warnings.push(`Claude tools 元数据已转为提示引导：${toolsList.join(', ')}`)
      if (disallowedList.length > 0) warnings.push(`Claude disallowedTools 已转为提示引导：${disallowedList.join(', ')}`)
      if (analysis.check_lines.length > 0) warnings.push(`检测到 ${analysis.tool_comments.length} 个工具名引用`)

      const hasManualWork = !!((agent.permissionMode && !mapPermissionMode(agent.permissionMode)) || toolsList.length || disallowedList.length || toStringArray(agent.skills).length)

      const id = itemId('Subagent', agent.name, agent.source)
      items.push({
        id,
        status: hasManualWork || warnings.length > 0 ? 'check' : 'added',
        type: 'Subagent',
        name: agent.name,
        source: agent.source,
        target,
        notes: '转换为 Codex subagent（.toml，含模型/权限映射）',
        warnings,
        structured_warnings: analysis,
      })
      actions.push({ itemId: id, target, content: renderAgentToml(agent) })
    }

    // ── Commands → Skills (was unsupported, now converted) ──
    for (const command of found.commands) {
      const skillName = `source-command-${command.name}`
      const target = path.join(root, CODEX_SKILLS_ROOT, skillName, 'SKILL.md')
      const analysis = analyzeContent(command.body)
      const id = itemId('Command', command.name, command.source)
      items.push({
        id,
        status: 'check',
        type: 'Command',
        name: command.name,
        source: command.source,
        target,
        notes: '转换为 Codex skill（斜杠命令→技能，需手动审查模板占位符）',
        warnings: ['命令已转换为 Codex skill，需人工审查运行时占位符和模板变量'],
        structured_warnings: analysis,
      })
      actions.push({ itemId: id, target, content: renderCommandAsSkill(command) })
    }

    // ── Hooks → .codex/hooks.json ──
    if (found.hooks.matcherGroups.length > 0) {
      const hooksContent = renderCodexHooksJson(found.hooks)
      const warnings: string[] = []
      if (found.hooks.unsupportedFields.length > 0) {
        warnings.push(`不支持的 hook 字段需审查：${found.hooks.unsupportedFields.join(', ')}`)
      }
      warnings.push('Codex hooks 需启用 [features].codex_hooks = true，仅执行 command 类型处理器')
      const id = itemId('Hook', 'hooks.json', scope.root)
      const target = path.join(root, CODEX_HOOKS_PATH)
      items.push({
        id,
        status: 'check',
        type: 'Hook',
        name: 'hooks.json',
        source: CLAUDE_SETTINGS_JSON_RELATIVE.map((r) => path.join(scope.root, r)).filter((p) => fs.existsSync(p)).join(', '),
        target,
        notes: '转换 Claude hooks 为 Codex hooks.json 格式',
        warnings,
        structured_warnings: { removed_lines: [], tool_comments: [], check_lines: [], manual_notes: found.hooks.unsupportedFields },
      })
      actions.push({ itemId: id, target, content: hooksContent })
    }

    // ── Settings + MCP → .codex/config.toml ──
    if (Object.keys(found.settings).length > 0 || found.mcpServers.length > 0) {
      const hasHooks = found.hooks.matcherGroups.length > 0
      const configContent = renderCodexConfigToml(found.settings, found.mcpServers, hasHooks)
      const warnings: string[] = []
      if (found.mcpServers.length > 0) warnings.push(`转换 ${found.mcpServers.length} 个 MCP 服务器配置`)
      const model = typeof found.settings.model === 'string' ? found.settings.model : null
      if (model) warnings.push(`模型映射：${model} → ${mapModelName(model)}`)
      const permMode = typeof found.settings.permissionMode === 'string' ? found.settings.permissionMode : null
      if (permMode) {
        const mapped = mapPermissionMode(permMode)
        warnings.push(mapped ? `权限模式映射：${permMode} → ${mapped}` : `权限模式 ${permMode} 无直接映射`)
      }

      const id = itemId('Settings', 'config.toml', scope.root)
      const target = path.join(root, CODEX_CONFIG_PATH)
      items.push({
        id,
        status: 'check',
        type: 'Settings',
        name: 'config.toml',
        source: CLAUDE_SETTINGS_JSON_RELATIVE.map((r) => path.join(scope.root, r)).filter((p) => fs.existsSync(p)).join(', '),
        target,
        notes: '转换 Claude settings/MCP 为 Codex config.toml（含 personality="friendly"）',
        warnings,
        structured_warnings: { removed_lines: [], tool_comments: [], check_lines: [], manual_notes: [] },
      })
      actions.push({ itemId: id, target, content: configContent })
    }

    // ── Plugins (report-only, no auto-migration) ──
    for (const plugin of found.plugins) {
      const id = itemId('Plugin', plugin.label, path.join(scope.root, plugin.relative))
      items.push({
        id,
        status: 'unsupported',
        type: 'Plugin',
        name: plugin.label,
        source: path.join(scope.root, plugin.relative),
        target: '',
        notes: '需手动迁移（Codex 无等价插件机制）',
        warnings: [],
        structured_warnings: null,
      })
    }
  }

  // Deduplicate by target path — project-scope items take priority over global
  const seenTargets = new Map<string, string>()
  const removedIds = new Set<string>()
  for (const item of items) {
    if (!item.target) continue
    const existing = seenTargets.get(item.target)
    if (existing) {
      const existingItem = items.find((i: any) => i.id === existing)
      const existingIsGlobal = existingItem?.source?.includes('/.claude/') || existingItem?.source?.includes('/.codex/')
      const currentIsGlobal = item.source?.includes('/.claude/') || item.source?.includes('/.codex/')
      if (existingIsGlobal && !currentIsGlobal) {
        removedIds.add(existing)
        seenTargets.set(item.target, item.id)
      } else {
        removedIds.add(item.id)
      }
    } else {
      seenTargets.set(item.target, item.id)
    }
  }
  const dedupedItems = items.filter((i: any) => !removedIds.has(i.id))
  const dedupedActions = actions.filter((a) => !removedIds.has(a.itemId))

  const contentMap = new Map<string, { source_content: string; target_content: string; existing_content: string }>()
  for (const action of dedupedActions) {
    if (action.copyFrom || contentMap.has(action.itemId)) continue
    const item = dedupedItems.find((i: any) => i.id === action.itemId)
    if (!item) continue
    const sourceContent = fs.existsSync(item.source) ? readText(item.source) : ''
    const existingContent = item.target && fs.existsSync(item.target) ? readText(item.target) : ''
    contentMap.set(action.itemId, { source_content: sourceContent, target_content: action.content, existing_content: existingContent })
  }

  return { items: dedupedItems, actions: dedupedActions, contentMap }
}

// ── Write / backup ─────────────────────────────────────────────────────────

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
    if (action.copyFrom) {
      fs.copyFileSync(action.copyFrom, action.target)
    } else {
      fs.writeFileSync(action.target, action.content, 'utf8')
    }
    itemActions.set(action.itemId, targetExists ? 'would_overwrite' : 'would_write')
  }
  return { written, skipped, overwritten, backups, errors, itemActions }
}

// ── Annotate helpers ───────────────────────────────────────────────────────

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

function attachContent(items: any[], contentMap: Map<string, { source_content: string; target_content: string; existing_content: string }>) {
  return items.map((item) => {
    const content = contentMap.get(item.id)
    if (!content) return item
    return { ...item, source_content: content.source_content, target_content: content.target_content, existing_content: content.existing_content }
  })
}

function filterByIds(items: any[], actions: WriteAction[], ids?: string[] | null) {
  if (!ids || ids.length === 0) return { items, actions }
  const idSet = new Set(ids)
  return {
    items: items.filter((item) => idSet.has(item.id)),
    actions: actions.filter((action) => idSet.has(action.itemId)),
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function syncScan(req: SyncRequest) {
  return { items: makeItems(req).items.map(({ id, status, notes, warnings, ...item }) => item) }
}

export function syncPlan(req: SyncRequest) {
  const { items: rawItems, contentMap } = makeItems(req)
  const items = attachContent(annotatePlanConflicts(rawItems, req.replace), contentMap)
  const added = items.filter((item) => item.status === 'added').length
  const check = items.filter((item) => item.status === 'check').length
  const conflicts = items.filter((item) => item.status === 'conflict').length
  const unsupported = items.filter((item) => item.status === 'unsupported').length
  return { items, stats: { migratable: added + check, needs_conversion: check, conflicts, unsupported } }
}

export function syncDryRun(req: SyncRequest) {
  const made = makeItems(req)
  const { items, actions } = filterByIds(made.items, made.actions, req.item_ids)
  const report = writeActions(actions, true, req.replace)
  return { dry_run: true, items: attachContent(annotateDryRunActions(items, report), made.contentMap), would_write: report.written, would_skip: report.skipped, would_overwrite: report.overwritten }
}

export function syncExecute(req: SyncRequest) {
  const made = makeItems(req)
  const { items, actions } = filterByIds(made.items, made.actions, req.item_ids)
  const report = writeActions(actions, false, req.replace)
  return { dry_run: false, items: attachContent(annotateDryRunActions(items, report), made.contentMap), written: report.written, skipped: report.skipped, overwritten: report.overwritten, backups: report.backups, errors: report.errors }
}

// ── Post-migration validation ──────────────────────────────────────────────

export interface ValidationItem {
  status: 'ok' | 'warning' | 'error'
  target: string
  type: string
  detail: string
}

const MAX_AGENTS_MD_BYTES = 32 * 1024

function commandOnPath(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function syncValidate(req: SyncRequest): { items: ValidationItem[] } {
  const home = req.home_path || homeDir()
  const project = req.project_path || null
  const results: ValidationItem[] = []
  const roots = [
    ...(req.scope === 'all' || req.scope === 'global' ? [home] : []),
    ...(project && (req.scope === 'all' || req.scope === 'project') ? [project] : []),
  ]

  for (const root of roots) {
    // ── AGENTS.md size ──
    const agentsMdPaths = [
      path.join(root, 'AGENTS.md'),
      path.join(root, '.codex', 'AGENTS.md'),
    ]
    for (const p of agentsMdPaths) {
      if (!fs.existsSync(p)) continue
      const size = fs.statSync(p).size
      if (size > MAX_AGENTS_MD_BYTES) {
        results.push({ status: 'warning', target: p, type: 'Instruction', detail: `${(size / 1024).toFixed(1)}KB 超过 32KB 审查阈值` })
      } else {
        results.push({ status: 'ok', target: p, type: 'Instruction', detail: `${(size / 1024).toFixed(1)}KB，在 32KB 阈值内` })
      }
    }

    // ── Skill frontmatter ──
    const skillsRoot = path.join(root, CODEX_SKILLS_ROOT)
    if (isDirectory(skillsRoot)) {
      for (const dirName of fs.readdirSync(skillsRoot)) {
        const skillFile = path.join(skillsRoot, dirName, 'SKILL.md')
        if (!isFile(skillFile)) continue
        const content = readText(skillFile)
        const fm = parseFrontmatter(content)
        const missing = ['name', 'description'].filter((k) => !fm.data[k])
        if (missing.length > 0) {
          results.push({ status: 'error', target: skillFile, type: 'Skill', detail: `frontmatter 缺少 ${missing.join(', ')}` })
        } else {
          results.push({ status: 'ok', target: skillFile, type: 'Skill', detail: 'frontmatter 包含 name 和 description' })
        }
      }
    }

    // ── Agent TOML syntax + required fields ──
    const agentsRoot = path.join(root, CODEX_AGENTS_ROOT)
    if (isDirectory(agentsRoot)) {
      for (const name of fs.readdirSync(agentsRoot).filter((n) => n.endsWith('.toml'))) {
        const agentFile = path.join(agentsRoot, name)
        const content = readText(agentFile)
        try {
          const parsed = parseToml(content) as Record<string, unknown>
          const missing = ['name', 'description', 'developer_instructions'].filter((k) => !parsed[k])
          if (missing.length > 0) {
            results.push({ status: 'error', target: agentFile, type: 'Subagent', detail: `TOML 缺少字段：${missing.join(', ')}` })
          } else {
            results.push({ status: 'ok', target: agentFile, type: 'Subagent', detail: 'TOML 语法正确，必填字段完整' })
          }
        } catch (err) {
          results.push({ status: 'error', target: agentFile, type: 'Subagent', detail: `TOML 语法错误：${err instanceof Error ? err.message : String(err)}` })
        }
      }
    }

    // ── config.toml syntax + MCP command PATH ──
    const configFile = path.join(root, CODEX_CONFIG_PATH)
    if (isFile(configFile)) {
      const content = readText(configFile)
      try {
        const parsed = parseToml(content) as Record<string, unknown>
        results.push({ status: 'ok', target: configFile, type: 'Settings', detail: 'config.toml 语法正确' })
        const mcpServers = parsed.mcp_servers as Record<string, unknown> | undefined
        if (mcpServers && typeof mcpServers === 'object') {
          for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
            if (!serverConfig || typeof serverConfig !== 'object') continue
            const cmd = (serverConfig as Record<string, unknown>).command
            if (typeof cmd !== 'string') continue
            if (commandOnPath(cmd)) {
              results.push({ status: 'ok', target: configFile, type: 'MCP', detail: `MCP server \`${serverName}\` 命令 \`${cmd}\` 在 PATH 中` })
            } else {
              results.push({ status: 'warning', target: configFile, type: 'MCP', detail: `MCP server \`${serverName}\` 命令 \`${cmd}\` 不在 PATH 中` })
            }
          }
        }
      } catch (err) {
        results.push({ status: 'error', target: configFile, type: 'Settings', detail: `config.toml 语法错误：${err instanceof Error ? err.message : String(err)}` })
      }
    }

    // ── hooks.json syntax ──
    const hooksFile = path.join(root, CODEX_HOOKS_PATH)
    if (isFile(hooksFile)) {
      try {
        JSON.parse(readText(hooksFile))
        results.push({ status: 'ok', target: hooksFile, type: 'Hook', detail: 'hooks.json 语法正确' })
      } catch (err) {
        results.push({ status: 'error', target: hooksFile, type: 'Hook', detail: `hooks.json 语法错误：${err instanceof Error ? err.message : String(err)}` })
      }
    }
  }

  return { items: results }
}

// ── Migration report ───────────────────────────────────────────────────────

export function syncReport(executeResult: {
  items: any[]
  written: string[]
  skipped: string[]
  overwritten: string[]
  backups: Array<{ target: string; backup: string }>
  errors?: string[]
}, validation?: { items: ValidationItem[] }): string {
  const lines: string[] = []
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  lines.push(`# 迁移报告 — ${now}`)
  lines.push('')

  // ── Summary ──
  const total = executeResult.items.length
  const added = executeResult.items.filter((i) => i.status === 'added').length
  const check = executeResult.items.filter((i) => i.status === 'check').length
  const unsupported = executeResult.items.filter((i) => i.status === 'unsupported').length
  lines.push('## 概要')
  lines.push('')
  lines.push(`| 指标 | 数量 |`)
  lines.push(`|------|------|`)
  lines.push(`| 总项数 | ${total} |`)
  lines.push(`| 已写入 | ${executeResult.written.length} |`)
  lines.push(`| 已覆盖 | ${executeResult.overwritten.length} |`)
  lines.push(`| 已跳过 | ${executeResult.skipped.length} |`)
  lines.push(`| 自动迁移 | ${added} |`)
  lines.push(`| 需人工审查 | ${check} |`)
  lines.push(`| 不可迁移 | ${unsupported} |`)
  if (executeResult.errors?.length) {
    lines.push(`| 错误 | ${executeResult.errors.length} |`)
  }
  lines.push('')

  // ── Item details ──
  lines.push('## 迁移项明细')
  lines.push('')
  lines.push('| 状态 | 类型 | 名称 | 目标路径 | 说明 |')
  lines.push('|------|------|------|----------|------|')
  for (const item of executeResult.items) {
    const statusEmoji = item.status === 'added' ? '✅' : item.status === 'check' ? '⚠️' : item.status === 'unsupported' ? '🚫' : item.status === 'conflict' ? '⚡' : '❔'
    const target = item.target ? path.basename(item.target) : '-'
    lines.push(`| ${statusEmoji} ${item.status} | ${item.type} | ${item.name} | ${target} | ${item.notes || ''} |`)
  }
  lines.push('')

  // ── Warnings ──
  const itemsWithWarnings = executeResult.items.filter((i) => i.warnings?.length > 0)
  if (itemsWithWarnings.length > 0) {
    lines.push('## 警告与人工审查项')
    lines.push('')
    for (const item of itemsWithWarnings) {
      lines.push(`### ${item.type}: ${item.name}`)
      lines.push('')
      for (const w of item.warnings) {
        lines.push(`- ${w}`)
      }
      lines.push('')
    }
  }

  // ── Backups ──
  if (executeResult.backups.length > 0) {
    lines.push('## 备份记录')
    lines.push('')
    lines.push('| 目标文件 | 备份文件 |')
    lines.push('|----------|----------|')
    for (const b of executeResult.backups) {
      lines.push(`| ${path.basename(b.target)} | ${path.basename(b.backup)} |`)
    }
    lines.push('')
  }

  // ── Errors ──
  if (executeResult.errors?.length) {
    lines.push('## 错误')
    lines.push('')
    for (const e of executeResult.errors) {
      lines.push(`- ${e}`)
    }
    lines.push('')
  }

  // ── Validation results ──
  if (validation && validation.items.length > 0) {
    lines.push('## 验证结果')
    lines.push('')
    lines.push('| 状态 | 类型 | 目标 | 说明 |')
    lines.push('|------|------|------|------|')
    for (const v of validation.items) {
      const emoji = v.status === 'ok' ? '✅' : v.status === 'warning' ? '⚠️' : '❌'
      lines.push(`| ${emoji} ${v.status} | ${v.type} | ${path.basename(v.target)} | ${v.detail} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
