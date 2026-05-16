import type { ApiSessionStats } from '@/core/api'

function formatTokens(n: number) {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function formatDuration(ms: number) {
  if (ms === 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes}m ${remainSeconds}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function SessionStatsPanel({ stats }: { stats: ApiSessionStats }) {
  const totalTokens = stats.tokenUsage.inputTokens + stats.tokenUsage.outputTokens
  return (
    <div className="border border-border-default bg-surface-card rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="消息" value={stats.messageCount} />
        <Metric label="工具" value={stats.toolCallCount} />
        <Metric label="失败" value={stats.failedToolCallCount} tone={stats.failedToolCallCount > 0 ? 'warn' : 'muted'} />
      </div>

      {/* Token usage */}
      {totalTokens > 0 && (
        <div>
          <div className="text-2xs font-medium text-text-tertiary mb-1.5">Token 用量</div>
          <div className="grid grid-cols-2 gap-1.5">
            <MiniMetric label="输入" value={formatTokens(stats.tokenUsage.inputTokens)} />
            <MiniMetric label="输出" value={formatTokens(stats.tokenUsage.outputTokens)} />
            {stats.tokenUsage.cacheReadTokens > 0 && (
              <MiniMetric label="缓存读取" value={formatTokens(stats.tokenUsage.cacheReadTokens)} color="text-emerald-600" />
            )}
            {stats.tokenUsage.cacheCreationTokens > 0 && (
              <MiniMetric label="缓存创建" value={formatTokens(stats.tokenUsage.cacheCreationTokens)} color="text-amber-600" />
            )}
          </div>
        </div>
      )}

      {/* Duration */}
      {stats.totalDurationMs > 0 && (
        <div>
          <div className="text-2xs font-medium text-text-tertiary mb-1.5">耗时</div>
          <div className="grid grid-cols-2 gap-1.5">
            <MiniMetric label="总耗时" value={formatDuration(stats.totalDurationMs)} />
            <MiniMetric label="平均轮次" value={formatDuration(stats.avgTurnDurationMs)} />
          </div>
        </div>
      )}

      {/* Models */}
      {stats.models.length > 0 && (
        <div>
          <div className="text-2xs font-medium text-text-tertiary mb-1.5">模型</div>
          <div className="flex flex-wrap gap-1.5">
            {stats.models.slice(0, 5).map((m) => (
              <span key={m.name} className="px-2 py-1 rounded-md bg-indigo-50 text-2xs text-indigo-700">
                {m.name} · {m.count}
              </span>
            ))}
          </div>
        </div>
      )}

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

function MiniMetric({ label, value, color = 'text-text-primary' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-base rounded-md px-2 py-1">
      <div className="text-2xs text-text-tertiary">{label}</div>
      <div className={`text-xs font-medium ${color}`}>{value}</div>
    </div>
  )
}
