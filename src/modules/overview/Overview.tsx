import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { agentRegistry } from '@/core/agent-registry'
import { api } from '@/core/api'

export function Overview() {
  const { agentSummaries, setAgentSummaries, projectPath } = useAppStore()

  useEffect(() => {
    api.agents.list(projectPath).then(setAgentSummaries).catch(console.error)
  }, [projectPath, setAgentSummaries])

  const agents = agentRegistry.getAll()

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">概览</h1>
        <p className="mt-1 text-sm text-text-secondary">
          当前本地检测到的 Claude / Codex 配置状态
        </p>
      </div>

      {/* Agent status cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {agents.map((agent) => {
          const summary = agentSummaries.find((s) => s.id === agent.id)
          return (
            <div key={agent.id} className="bg-surface-card border border-border-default rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${agent.color}20` }}
                  >
                    <agent.Icon size={16} color={agent.color} />
                  </div>
                  <span className="font-medium text-text-primary">{agent.shortName}</span>
                  <span className="text-xs text-text-tertiary">{agent.globalDir}</span>
                </div>
                {summary && (
                  <StatusBadge status={summary.status} />
                )}
              </div>
              {summary ? (
                <p className="text-xs text-text-secondary">
                  检测到 {summary.file_count} 个配置文件
                </p>
              ) : (
                <p className="text-xs text-text-tertiary">正在检测…</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Config comparison table */}
      <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-medium text-text-primary">配置对照</h2>
        </div>
        <ComparisonTable />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: '活跃中', className: 'bg-green-100 text-green-700' },
    not_installed: { label: '未安装', className: 'bg-gray-100 text-gray-500' },
    partial: { label: '部分配置', className: 'bg-yellow-100 text-yellow-700' },
  }
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  )
}

function ComparisonTable() {
  const { agentFiles } = useAppStore()
  const claude = agentRegistry.get('claude')
  const codex = agentRegistry.get('codex')

  const rows = [
    { label: '全局指令', claudeKey: 'global_instructions', codexKey: 'global_instructions' },
    { label: '项目指令', claudeKey: 'project_instructions', codexKey: 'project_instructions' },
    { label: '技能（Skills）', claudeKey: 'global_skills', codexKey: 'global_skills' },
    { label: '自定义 Agent', claudeKey: 'project_agents', codexKey: 'project_agents' },
    { label: '全局配置', claudeKey: 'global_settings', codexKey: 'global_config' },
  ]

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border-subtle">
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary w-36">配置类型</th>
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
        {rows.map((row) => {
          const claudeFile = agentFiles['claude']?.find((f) => f.key === row.claudeKey)
          const codexFile = agentFiles['codex']?.find((f) => f.key === row.codexKey)
          return (
            <tr key={row.label} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover">
              <td className="px-4 py-2.5 text-text-secondary font-medium">{row.label}</td>
              <td className="px-4 py-2.5">
                <FileStatusCell file={claudeFile} />
              </td>
              <td className="px-4 py-2.5">
                <FileStatusCell file={codexFile} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function FileStatusCell({ file }: { file?: { label: string; exists: boolean; status: string } }) {
  if (!file) return <span className="text-text-tertiary text-xs">—</span>

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          file.exists ? 'bg-status-active' : 'bg-border-default'
        }`}
      />
      <span className={`text-xs ${file.exists ? 'text-text-primary' : 'text-text-tertiary'}`}>
        {file.label}
      </span>
      {file.exists && (
        <span className="text-2xs text-text-tertiary capitalize">{file.status}</span>
      )}
    </div>
  )
}
