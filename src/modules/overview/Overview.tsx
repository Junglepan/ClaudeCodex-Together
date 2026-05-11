import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useAgents } from '@/hooks/useAgents'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import type { ApiConfigFile } from '@/core/api'
import { CardSkeleton } from '@/components/ui/Skeleton'

// ── Key files that trigger a warning when missing ────────────────────────────
const KEY_GLOBAL: Record<string, string[]> = {
  claude: ['global_settings'],
  codex:  ['global_config'],
}

// ── Global layer row definitions per agent ───────────────────────────────────
const GLOBAL_ROWS: Record<string, Array<{ key: string; label: string }>> = {
  claude: [
    { key: 'global_instructions', label: '全局指令' },
    { key: 'global_skills',       label: '技能' },
    { key: 'global_agents',       label: 'Agents' },
    { key: 'global_commands',     label: '命令' },
    { key: 'global_settings',     label: '全局设置' },
  ],
  codex: [
    { key: 'global_instructions', label: '全局指令' },
    { key: 'global_skills',       label: '技能' },
    { key: 'global_agents',       label: 'Agents' },
    { key: 'global_config',       label: '全局配置' },
    { key: 'global_memories',     label: '记忆系统' },
  ],
}

const PROJECT_ROWS: Record<string, Array<{ key: string; label: string }>> = {
  claude: [
    { key: 'project_instructions', label: 'CLAUDE.md' },
    { key: 'project_agents',       label: '.claude/agents/' },
    { key: 'project_settings',     label: '项目设置' },
  ],
  codex: [
    { key: 'project_instructions', label: 'AGENTS.md' },
    { key: 'project_agents',       label: '.codex/agents/' },
    { key: 'project_config',       label: '项目配置' },
  ],
}

// ── Comparison table ─────────────────────────────────────────────────────────
const COMPARISON_ROWS: Array<{
  label: string
  claudeKey: string
  codexKey: string | null  // null = Codex N/A
}> = [
  { label: '全局指令',   claudeKey: 'global_instructions', codexKey: 'global_instructions' },
  { label: '全局技能',   claudeKey: 'global_skills',       codexKey: 'global_skills' },
  { label: '全局 Agent', claudeKey: 'global_agents',       codexKey: 'global_agents' },
  { label: '全局设置',   claudeKey: 'global_settings',     codexKey: 'global_config' },
  { label: '斜杠命令',   claudeKey: 'global_commands',     codexKey: null },
  { label: '项目指令',   claudeKey: 'project_instructions', codexKey: 'project_instructions' },
  { label: '项目 Agent', claudeKey: 'project_agents',       codexKey: 'project_agents' },
  { label: '项目设置',   claudeKey: 'project_settings',     codexKey: 'project_config' },
]

type SyncStatus = 'aligned' | 'can_migrate' | 'pending_import' | 'unconfigured' | 'na'

function getSyncStatus(claudeFile?: ApiConfigFile, codexFile?: ApiConfigFile, codexNA = false): SyncStatus {
  if (codexNA) return 'na'
  const c = claudeFile?.exists ?? false
  const x = codexFile?.exists ?? false
  if (c && x)  return 'aligned'
  if (c && !x) return 'can_migrate'
  if (!c && x) return 'pending_import'
  return 'unconfigured'
}

const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; color: string }> = {
  aligned:       { label: '✓ 已对齐',        color: 'text-green-600 bg-green-50' },
  can_migrate:   { label: '→ 可迁移',         color: 'text-orange-600 bg-orange-50' },
  pending_import:{ label: '← 待引入',         color: 'text-blue-600 bg-blue-50' },
  unconfigured:  { label: '○ 均未配置',        color: 'text-text-tertiary bg-surface-base' },
  na:            { label: '─ 仅适用于 Claude', color: 'text-text-tertiary bg-surface-base' },
}

// ── Components ───────────────────────────────────────────────────────────────

export function Overview() {
  const { filesByAgent } = useAgents()
  const { loading, projectPath } = useAppStore()
  const agents = agentRegistry.getAll()

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">概览</h1>
        <p className="mt-1 text-sm text-text-secondary">
          当前本地检测到的 Claude / Codex 配置状态
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {loading && Object.keys(filesByAgent).length === 0
          ? agents.map((a) => <CardSkeleton key={a.id} />)
          : agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                files={filesByAgent[agent.id] ?? []}
                projectPath={projectPath}
              />
            ))}
      </div>

      {/* Comparison table */}
      <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-primary">Claude ↔ Codex 配置对照</h2>
          <p className="text-2xs text-text-tertiary mt-0.5">检查两侧配置是否对齐，"可迁移"表示 Claude 侧有内容但 Codex 侧尚未同步</p>
        </div>
        <ComparisonTable filesByAgent={filesByAgent} />
      </div>
    </div>
  )
}

function AgentCard({
  agent,
  files,
  projectPath,
}: {
  agent: ReturnType<typeof agentRegistry.getAll>[number]
  files: ApiConfigFile[]
  projectPath?: string
}) {
  const navigate = useNavigate()
  const globalRows  = GLOBAL_ROWS[agent.id]  ?? []
  const projectRows = PROJECT_ROWS[agent.id] ?? []

  const keyFiles    = KEY_GLOBAL[agent.id] ?? []
  const missingKeys = keyFiles.filter((k) => {
    const f = files.find((f) => f.key === k)
    return !f?.exists
  })

  return (
    <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${agent.color}20` }}>
          <agent.Icon size={16} color={agent.color} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-text-primary text-sm">{agent.name}</div>
          <div className="text-2xs text-text-tertiary font-mono truncate">{agent.globalDir}</div>
        </div>
        <button
          onClick={() => navigate(`/config/${agent.id}`)}
          className="text-2xs text-accent-blue hover:underline flex-shrink-0"
        >
          详情 →
        </button>
      </div>

      {/* Global section */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-2xs font-medium text-text-tertiary uppercase tracking-wide mb-2">全局</div>
        <div className="space-y-1">
          {globalRows.map((row) => {
            const file = files.find((f) => f.key === row.key)
            return <StatusRow key={row.key} label={row.label} file={file} />
          })}
        </div>
      </div>

      {/* Project section */}
      <div className="px-4 pt-2 pb-3 border-t border-border-subtle mt-2">
        <div className="text-2xs font-medium text-text-tertiary uppercase tracking-wide mb-2">
          当前项目{projectPath ? `: ${projectPath.split('/').pop()}` : ''}
        </div>
        {projectPath ? (
          <div className="space-y-1">
            {projectRows.map((row) => {
              const file = files.find((f) => f.key === row.key)
              return <StatusRow key={row.key} label={row.label} file={file} />
            })}
          </div>
        ) : (
          <p className="text-2xs text-text-tertiary italic">未选择项目 — 在顶部选择项目后展示项目配置状态</p>
        )}
      </div>

      {/* Warning bar */}
      {missingKeys.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
          <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
          <span className="text-2xs text-amber-700">关键配置文件未找到，{agent.shortName} 可能未初始化</span>
        </div>
      )}
      {missingKeys.length === 0 && files.length > 0 && (
        <div className="px-4 py-2 bg-green-50 border-t border-green-200 flex items-center gap-2">
          <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
          <span className="text-2xs text-green-700">配置完整</span>
        </div>
      )}
    </div>
  )
}

function StatusRow({ label, file }: { label: string; file?: ApiConfigFile }) {
  if (!file) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-border-default flex-shrink-0" />
        <span className="text-text-tertiary flex-1 truncate">{label}</span>
        <span className="text-2xs text-text-tertiary">─</span>
      </div>
    )
  }

  const isDir = file.kind === 'dir'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file.exists ? 'bg-green-400' : 'bg-border-default'}`} />
      <span className={`flex-1 truncate ${file.exists ? 'text-text-primary' : 'text-text-tertiary'}`}>{label}</span>
      <span className={`text-2xs flex-shrink-0 ${file.exists ? 'text-text-secondary' : 'text-text-tertiary'}`}>
        {file.exists
          ? (isDir ? '已配置' : file.label)
          : '未配置'}
      </span>
    </div>
  )
}

function ComparisonTable({ filesByAgent }: { filesByAgent: Record<string, ApiConfigFile[]> }) {
  const navigate = useNavigate()
  const claude = agentRegistry.get('claude')
  const codex  = agentRegistry.get('codex')

  const claudeFiles = filesByAgent['claude'] ?? []
  const codexFiles  = filesByAgent['codex']  ?? []

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border-subtle bg-surface-base/50">
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">配置功能</th>
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">
            <span className="flex items-center gap-1.5">
              {claude && <claude.Icon size={11} color={claude.color} />} Claude
            </span>
          </th>
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">
            <span className="flex items-center gap-1.5">
              {codex && <codex.Icon size={11} color={codex.color} />} Codex
            </span>
          </th>
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">同步状态</th>
        </tr>
      </thead>
      <tbody>
        {COMPARISON_ROWS.map((row) => {
          const cFile = claudeFiles.find((f) => f.key === row.claudeKey)
          const xFile = row.codexKey ? codexFiles.find((f) => f.key === row.codexKey) : undefined
          const status = getSyncStatus(cFile, xFile, row.codexKey === null)
          const sc = SYNC_STATUS_CONFIG[status]
          return (
            <tr key={row.label} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors">
              <td className="px-4 py-2.5 text-xs font-medium text-text-secondary">{row.label}</td>
              <td className="px-4 py-2.5">
                <ExistsCell file={cFile} />
              </td>
              <td className="px-4 py-2.5">
                {row.codexKey === null
                  ? <span className="text-2xs text-text-tertiary">─</span>
                  : <ExistsCell file={xFile} />}
              </td>
              <td className="px-4 py-2.5">
                <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${sc.color}`}>{sc.label}</span>
                {status === 'can_migrate' && (
                  <button onClick={() => navigate('/sync')} className="ml-2 text-2xs text-accent-blue hover:underline">
                    去同步
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ExistsCell({ file }: { file?: ApiConfigFile }) {
  if (!file) return <span className="text-2xs text-text-tertiary">—</span>
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file.exists ? 'bg-green-400' : 'bg-border-default'}`} />
      <span className={`text-xs font-mono truncate ${file.exists ? 'text-text-primary' : 'text-text-tertiary'}`}>
        {file.label}
      </span>
    </div>
  )
}
