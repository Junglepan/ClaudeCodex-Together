import { useAgents } from '@/hooks/useAgents'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import type { ApiConfigFile } from '@/core/api'
import { StatusBadge } from '@/components/ui/Badges'
import { CardSkeleton } from '@/components/ui/Skeleton'

export function Overview() {
  const { summaries, filesByAgent } = useAgents()
  const { loading } = useAppStore()
  const agents = agentRegistry.getAll()

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">概览</h1>
        <p className="mt-1 text-sm text-text-secondary">
          当前本地检测到的 Claude / Codex 配置状态
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {loading && summaries.length === 0
          ? agents.map((a) => <CardSkeleton key={a.id} />)
          : agents.map((agent) => {
              const summary = summaries.find((s) => s.id === agent.id)
              const files = filesByAgent[agent.id] ?? []
              const activeFiles = files.filter((f) => f.exists)
              return (
                <div
                  key={agent.id}
                  className="bg-surface-card border border-border-default rounded-xl p-4 hover:border-border-default/80 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        <agent.Icon size={16} color={agent.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary text-sm">{agent.shortName}</div>
                        <div className="text-2xs text-text-tertiary font-mono truncate">{agent.globalDir}</div>
                      </div>
                    </div>
                    {summary && <StatusBadge status={summary.status} />}
                  </div>
                  {summary ? (
                    <div className="flex gap-4 text-xs text-text-secondary">
                      <span><span className="font-medium text-text-primary">{activeFiles.length}</span> 个文件已存在</span>
                      <span><span className="font-medium text-text-tertiary">{files.length - activeFiles.length}</span> 个未创建</span>
                    </div>
                  ) : (
                    <p className="text-xs text-text-tertiary">正在检测…</p>
                  )}
                </div>
              )
            })}
      </div>

      <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
          <h2 className="text-sm font-medium text-text-primary">配置对照</h2>
          <span className="text-xs text-text-tertiary">按工作习惯层分组</span>
        </div>
        <ComparisonTable />
      </div>
    </div>
  )
}

const COMPARISON_ROWS: Array<{
  group: string
  label: string
  claudeKey: string
  codexKey: string
}> = [
  { group: '工作习惯层',  label: '项目指令',      claudeKey: 'project_instructions', codexKey: 'project_instructions' },
  { group: '工作习惯层',  label: '全局技能',      claudeKey: 'global_skills',        codexKey: 'global_skills' },
  { group: '工作习惯层',  label: '自定义 Agent',  claudeKey: 'project_agents',       codexKey: 'project_agents' },
  { group: '基础设施层',  label: '全局设置',      claudeKey: 'global_settings',      codexKey: 'global_config' },
  { group: '基础设施层',  label: '项目设置',      claudeKey: 'project_settings',     codexKey: 'project_config' },
]

function ComparisonTable() {
  const { agentFiles } = useAppStore()
  const claude = agentRegistry.get('claude')
  const codex  = agentRegistry.get('codex')

  const claudeFiles = agentFiles['claude'] ?? []
  const codexFiles  = agentFiles['codex']  ?? []

  const groups = [...new Set(COMPARISON_ROWS.map((r) => r.group))]

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border-subtle bg-surface-base/50">
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary w-32" />
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary w-40">配置类型</th>
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">
            <span className="flex items-center gap-1.5">
              {claude && <claude.Icon size={12} color={claude.color} />} Claude Code
            </span>
          </th>
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">
            <span className="flex items-center gap-1.5">
              {codex && <codex.Icon size={12} color={codex.color} />} Codex
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const rows = COMPARISON_ROWS.filter((r) => r.group === group)
          const isSyncLayer = group === '工作习惯层'
          return rows.map((row, i) => (
            <tr
              key={row.label}
              className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors"
            >
              {i === 0 ? (
                <td
                  className="px-4 py-2.5 text-2xs font-medium text-text-tertiary align-top"
                  rowSpan={rows.length}
                >
                  <span className={`px-1.5 py-0.5 rounded text-2xs ${
                    isSyncLayer ? 'bg-accent-blue/10 text-accent-blue' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {group}
                  </span>
                </td>
              ) : null}
              <td className="px-4 py-2.5 text-xs text-text-secondary font-medium">{row.label}</td>
              <td className="px-4 py-2.5">
                <FileStatusCell file={claudeFiles.find((f) => f.key === row.claudeKey)} />
              </td>
              <td className="px-4 py-2.5">
                <FileStatusCell
                  file={codexFiles.find((f) => f.key === row.codexKey)}
                  agentNotInstalled={agentFiles['codex'] === undefined}
                />
              </td>
            </tr>
          ))
        })}
      </tbody>
    </table>
  )
}

function FileStatusCell({
  file,
  agentNotInstalled,
}: {
  file?: ApiConfigFile
  agentNotInstalled?: boolean
}) {
  if (agentNotInstalled) {
    return <span className="text-2xs text-text-tertiary italic">agent 未安装</span>
  }
  if (!file) return <span className="text-text-tertiary text-xs">—</span>

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          file.exists ? 'bg-status-active' : 'bg-border-default'
        }`}
      />
      <span className={`text-xs truncate ${file.exists ? 'text-text-primary' : 'text-text-tertiary'}`}>
        {file.label}
      </span>
      {file.exists && (
        <span className="text-2xs text-text-tertiary capitalize flex-shrink-0">{file.status}</span>
      )}
    </div>
  )
}
