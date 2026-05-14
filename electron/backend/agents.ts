import path from 'node:path'
import { exists, fileInfo, homeDir, isFile, readText, resolveTemplate } from './fsUtils'
import type { AgentId, AgentSummary, ConfigFileResult, ConfigFileSpec } from './types'

const commonClaudeDetails = 'Claude Code local configuration file.'
const commonCodexDetails = 'Codex CLI local configuration file.'

const claudeSpecs: ConfigFileSpec[] = [
  { key: 'global_instructions', label: 'CLAUDE.md', pathTemplate: '{home}/.claude/CLAUDE.md', scope: 'global', kind: 'file', format: 'markdown', purpose: '全局自然语言指令', details: commonClaudeDetails, counterpartAgent: 'codex', counterpartKey: 'global_instructions' },
  { key: 'global_settings', label: 'settings.json', pathTemplate: '{home}/.claude/settings.json', scope: 'global', kind: 'file', format: 'json', purpose: 'Claude 全局行为与工具权限设置', details: commonClaudeDetails, counterpartAgent: 'codex', counterpartKey: 'global_config' },
  { key: 'global_auth', label: '.claude.json', pathTemplate: '{home}/.claude.json', scope: 'global', kind: 'file', format: 'json', purpose: 'Claude 认证状态，只读展示', details: commonClaudeDetails },
  { key: 'global_skills', label: 'skills/', pathTemplate: '{home}/.claude/skills/', scope: 'global', kind: 'dir', format: 'dir', purpose: '全局 Claude skills', details: commonClaudeDetails, counterpartAgent: 'codex', counterpartKey: 'global_skills' },
  { key: 'global_agents', label: 'agents/', pathTemplate: '{home}/.claude/agents/', scope: 'global', kind: 'dir', format: 'dir', purpose: '全局 Claude agents', details: commonClaudeDetails, counterpartAgent: 'codex', counterpartKey: 'global_agents' },
  { key: 'global_commands', label: 'commands/', pathTemplate: '{home}/.claude/commands/', scope: 'global', kind: 'dir', format: 'dir', purpose: 'Claude 斜杠命令目录', details: commonClaudeDetails },
  { key: 'global_plugins', label: 'installed_plugins.json', pathTemplate: '{home}/.claude/plugins/installed_plugins.json', scope: 'global', kind: 'file', format: 'json', purpose: 'Claude 插件清单', details: commonClaudeDetails },
  { key: 'project_instructions', label: 'CLAUDE.md', pathTemplate: '{project}/CLAUDE.md', scope: 'project', kind: 'file', format: 'markdown', purpose: '项目级 Claude 指令', details: commonClaudeDetails, counterpartAgent: 'codex', counterpartKey: 'project_instructions' },
  { key: 'project_settings', label: '.claude/settings.json', pathTemplate: '{project}/.claude/settings.json', scope: 'project', kind: 'file', format: 'json', purpose: '项目级 Claude 配置', details: commonClaudeDetails, counterpartAgent: 'codex', counterpartKey: 'project_config' },
  { key: 'project_settings_local', label: '.claude/settings.local.json', pathTemplate: '{project}/.claude/settings.local.json', scope: 'project', kind: 'file', format: 'json', purpose: '项目本地 Claude 覆盖配置', details: commonClaudeDetails },
  { key: 'project_agents', label: '.claude/agents/', pathTemplate: '{project}/.claude/agents/', scope: 'project', kind: 'dir', format: 'dir', purpose: '项目级 Claude agents', details: commonClaudeDetails, counterpartAgent: 'codex', counterpartKey: 'project_agents' },
  { key: 'project_commands', label: '.claude/commands/', pathTemplate: '{project}/.claude/commands/', scope: 'project', kind: 'dir', format: 'dir', purpose: '项目级 Claude 斜杠命令', details: commonClaudeDetails },
  { key: 'project_mcp', label: '.mcp.json', pathTemplate: '{project}/.mcp.json', scope: 'project', kind: 'file', format: 'json', purpose: '项目 MCP 配置', details: commonClaudeDetails },
]

const codexSpecs: ConfigFileSpec[] = [
  { key: 'global_config', label: 'config.toml', pathTemplate: '{home}/.codex/config.toml', scope: 'global', kind: 'file', format: 'toml', purpose: 'Codex CLI 主配置文件', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'global_settings' },
  { key: 'global_instructions', label: 'AGENTS.md', pathTemplate: '{home}/.codex/AGENTS.md', scope: 'global', kind: 'file', format: 'markdown', purpose: '全局 Codex 指令', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'global_instructions' },
  { key: 'global_hooks', label: 'hooks.json', pathTemplate: '{home}/.codex/hooks.json', scope: 'global', kind: 'file', format: 'json', purpose: '全局 Codex hooks', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'global_settings' },
  { key: 'global_agents', label: '.codex/agents/', pathTemplate: '{home}/.codex/agents/', scope: 'global', kind: 'dir', format: 'dir', purpose: '全局 Codex agents', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'global_agents' },
  { key: 'global_skills', label: '.codex/skills/', pathTemplate: '{home}/.codex/skills/', scope: 'global', kind: 'dir', format: 'dir', purpose: '全局 Codex skills', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'global_skills' },
  { key: 'global_memories', label: 'memories/', pathTemplate: '{home}/.codex/memories/', scope: 'global', kind: 'dir', format: 'dir', purpose: 'Codex 记忆系统目录', details: commonCodexDetails },
  { key: 'global_auth', label: 'auth.json', pathTemplate: '{home}/.codex/auth.json', scope: 'global', kind: 'file', format: 'json', purpose: 'Codex 认证状态，只读展示', details: commonCodexDetails },
  { key: 'project_config', label: '.codex/config.toml', pathTemplate: '{project}/.codex/config.toml', scope: 'project', kind: 'file', format: 'toml', purpose: '项目级 Codex 配置', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'project_settings' },
  { key: 'project_instructions', label: 'AGENTS.md', pathTemplate: '{project}/AGENTS.md', scope: 'project', kind: 'file', format: 'markdown', purpose: '项目级 Codex 指令', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'project_instructions' },
  { key: 'project_hooks', label: '.codex/hooks.json', pathTemplate: '{project}/.codex/hooks.json', scope: 'project', kind: 'file', format: 'json', purpose: '项目级 Codex hooks', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'project_settings' },
  { key: 'project_agents', label: '.codex/agents/', pathTemplate: '{project}/.codex/agents/', scope: 'project', kind: 'dir', format: 'dir', purpose: '项目级 Codex agents', details: commonCodexDetails, counterpartAgent: 'claude', counterpartKey: 'project_agents' },
]

const definitions = {
  claude: { id: 'claude' as const, name: 'Claude Code', globalDir: '{home}/.claude', specs: claudeSpecs },
  codex: { id: 'codex' as const, name: 'OpenAI Codex CLI', globalDir: '{home}/.codex', specs: codexSpecs },
}

export function allAgents() {
  return Object.values(definitions)
}

export function getAgent(agentId: string) {
  return definitions[agentId as AgentId]
}

function inferStatus(spec: ConfigFileSpec, fileExists: boolean): ConfigFileResult['status'] {
  if (!fileExists) return 'missing'
  if (spec.key.includes('settings') || spec.key.includes('instructions') || spec.scope === 'global') return 'active'
  return 'available'
}

export function scanAgentFiles(agentId: string, project?: string | null): ConfigFileResult[] {
  const agent = getAgent(agentId)
  if (!agent) throw new Error(`Agent '${agentId}' not found`)
  return agent.specs.map((spec) => {
    const target = path.normalize(resolveTemplate(spec.pathTemplate, project))
    const fileExists = exists(target)
    const info: { size?: number; modified?: string } = fileExists && isFile(target) ? fileInfo(target) : {}
    return {
      key: spec.key,
      label: spec.label,
      path: target,
      exists: fileExists,
      scope: spec.scope,
      kind: spec.kind,
      format: spec.format,
      status: inferStatus(spec, fileExists),
      size_bytes: info.size,
      modified_at: info.modified,
      purpose: spec.purpose,
      details: spec.details,
      counterpart_agent: spec.counterpartAgent,
      counterpart_key: spec.counterpartKey,
      sync_strategy: spec.syncStrategy,
    }
  })
}

export function listAgentSummaries(project?: string | null): AgentSummary[] {
  return allAgents().map((agent) => {
    const files = scanAgentFiles(agent.id, project)
    const existing = files.filter((file) => file.exists)
    return {
      id: agent.id,
      name: agent.name,
      status: existing.length === 0 ? 'not_installed' : existing.length === files.length ? 'active' : 'partial',
      global_path: resolveTemplate(agent.globalDir, project),
      file_count: existing.length,
    }
  })
}

export function getAgentFile(agentId: string, key: string, project?: string | null) {
  return scanAgentFiles(agentId, project).find((file) => file.key === key) ?? null
}

export function readAgentFile(agentId: string, key: string, project?: string | null) {
  const file = getAgentFile(agentId, key, project)
  if (!file || !file.exists || file.kind === 'dir') return null
  return readText(file.path)
}

export function counterpartFor(agentId: string, key: string, project?: string | null) {
  const agent = getAgent(agentId)
  const spec = agent?.specs.find((item) => item.key === key)
  if (!spec?.counterpartAgent || !spec.counterpartKey) return null
  return getAgentFile(spec.counterpartAgent, spec.counterpartKey, project)
}

export function homePath() {
  return homeDir()
}
