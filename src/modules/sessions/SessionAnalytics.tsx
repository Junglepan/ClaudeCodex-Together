import { Activity, Database, MessageSquare, Terminal } from 'lucide-react'
import type { ApiSessionOverview, ApiSessionStats } from '@/core/api'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function OverviewStats({ overview }: { overview: ApiSessionOverview | null }) {
  const items = [
    { label: '会话', value: overview?.totalSessions ?? 0, Icon: MessageSquare },
    { label: '消息', value: overview?.totalMessages ?? 0, Icon: Activity },
    { label: '工具调用', value: overview?.totalToolCalls ?? 0, Icon: Terminal },
    { label: '占用', value: formatBytes(overview?.totalSizeBytes ?? 0), Icon: Database },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ label, value, Icon }) => (
        <div key={label} className="border border-border-default bg-surface-card rounded-lg p-3">
          <div className="flex items-center gap-2 text-text-tertiary text-2xs">
            <Icon size={13} />
            {label}
          </div>
          <div className="mt-2 text-lg font-semibold text-text-primary">{value}</div>
        </div>
      ))}
    </div>
  )
}

export function SessionStatsPanel({ stats }: { stats: ApiSessionStats }) {
  return (
    <div className="border border-border-default bg-surface-card rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="消息" value={stats.messageCount} />
        <Metric label="工具" value={stats.toolCallCount} />
        <Metric label="失败" value={stats.failedToolCallCount} tone={stats.failedToolCallCount > 0 ? 'warn' : 'muted'} />
      </div>
      {stats.tools.length > 0 && (
        <div>
          <div className="text-2xs font-medium text-text-tertiary mb-1.5">工具分布</div>
          <div className="flex flex-wrap gap-1.5">
            {stats.tools.slice(0, 8).map((tool) => (
              <span key={tool.name} className="px-2 py-1 rounded-md bg-surface-base text-2xs text-text-secondary">
                {tool.name} · {tool.count}{tool.failedCount > 0 ? ` / 失败 ${tool.failedCount}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {stats.skills.length > 0 && (
        <div>
          <div className="text-2xs font-medium text-text-tertiary mb-1.5">技能使用</div>
          <div className="flex flex-wrap gap-1.5">
            {stats.skills.slice(0, 8).map((skill) => (
              <span key={skill.name} className="px-2 py-1 rounded-md bg-purple-50 text-2xs text-purple-700">
                {skill.name} · {skill.count}{skill.confidence === 'inferred' ? ' · 推断' : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'normal' }: { label: string; value: number; tone?: 'normal' | 'warn' | 'muted' }) {
  const color = tone === 'warn' ? 'text-amber-600' : tone === 'muted' ? 'text-text-tertiary' : 'text-text-primary'
  return (
    <div className="bg-surface-base rounded-md px-2 py-1.5">
      <div className="text-2xs text-text-tertiary">{label}</div>
      <div className={`font-medium ${color}`}>{value}</div>
    </div>
  )
}
