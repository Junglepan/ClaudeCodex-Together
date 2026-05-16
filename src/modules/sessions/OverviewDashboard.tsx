import { Activity, Clock, Cpu, Database, FolderOpen, MessageSquare, Terminal, Timer, TrendingUp, Zap } from 'lucide-react'
import type { ApiProjectSessionOverview, ApiSessionAgent, ApiSessionOverview, ApiTokenUsage } from '@/core/api'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTokens(n: number) {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const remainSeconds = Math.round(seconds % 60)
  if (minutes < 60) return `${minutes}m ${remainSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return `${hours}h ${remainMinutes}m`
}

function totalTokens(t: ApiTokenUsage) {
  return t.inputTokens + t.outputTokens
}

export function OverviewDashboard({
  agentId,
  overview,
  projects,
  loading,
  onSelectProject,
}: {
  agentId: ApiSessionAgent
  overview: ApiSessionOverview | null
  projects: ApiProjectSessionOverview[]
  loading: boolean
  onSelectProject: (path: string | null) => void
}) {
  const agentLabel = agentId === 'claude' ? 'Claude' : 'Codex'

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">{agentLabel} 会话概览</h1>
        <p className="mt-1 text-sm text-text-secondary">
          本地 {agentLabel} 会话的整体统计与项目分布。
        </p>
        {loading && <span className="text-2xs text-text-tertiary">加载中</span>}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={MessageSquare} label="总会话" value={overview?.totalSessions ?? 0} />
        <StatCard icon={Activity} label="总消息" value={overview?.totalMessages ?? 0} />
        <StatCard icon={TrendingUp} label="近 7 天活跃" value={overview?.recentSessionCount ?? 0} />
        <StatCard icon={Database} label="总占用" value={formatBytes(overview?.totalSizeBytes ?? 0)} />
        <StatCard icon={Zap} label="总 Token" value={overview ? formatTokens(totalTokens(overview.tokenUsage)) : 0} />
        <StatCard icon={Terminal} label="输入 Token" value={overview ? formatTokens(overview.tokenUsage.inputTokens) : 0} />
        <StatCard icon={Terminal} label="输出 Token" value={overview ? formatTokens(overview.tokenUsage.outputTokens) : 0} />
        <StatCard icon={Timer} label="总耗时" value={overview ? formatDuration(overview.totalDurationMs) : '—'} />
      </div>

      {/* Agent breakdown */}
      {overview && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border-default bg-surface-card rounded-lg p-4">
            <div className="text-2xs text-text-tertiary mb-2">Agent 分布</div>
            <div className="flex items-end gap-4">
              <div>
                <div className="text-2xl font-bold text-orange-600">{overview.agentBreakdown.claude}</div>
                <div className="text-xs text-text-secondary">Claude</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{overview.agentBreakdown.codex}</div>
                <div className="text-xs text-text-secondary">Codex</div>
              </div>
            </div>
          </div>
          <div className="border border-border-default bg-surface-card rounded-lg p-4">
            <div className="text-2xs text-text-tertiary mb-2">工具调用</div>
            <div className="flex items-end gap-4">
              <div>
                <div className="text-2xl font-bold text-text-primary">{overview.totalToolCalls}</div>
                <div className="text-xs text-text-secondary">总调用</div>
              </div>
              {overview.failedToolCalls > 0 && (
                <div>
                  <div className="text-2xl font-bold text-red-500">{overview.failedToolCalls}</div>
                  <div className="text-xs text-text-secondary">失败</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Token breakdown + Model distribution */}
      {overview && (totalTokens(overview.tokenUsage) > 0 || overview.topModels.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {totalTokens(overview.tokenUsage) > 0 && (
            <div className="border border-border-default bg-surface-card rounded-lg p-4">
              <div className="flex items-center gap-2 text-2xs text-text-tertiary mb-3">
                <Zap size={13} />
                Token 分布
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-lg font-bold text-text-primary">{formatTokens(overview.tokenUsage.inputTokens)}</div>
                  <div className="text-2xs text-text-tertiary">输入</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-text-primary">{formatTokens(overview.tokenUsage.outputTokens)}</div>
                  <div className="text-2xs text-text-tertiary">输出</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-emerald-600">{formatTokens(overview.tokenUsage.cacheReadTokens)}</div>
                  <div className="text-2xs text-text-tertiary">缓存读取</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-amber-600">{formatTokens(overview.tokenUsage.cacheCreationTokens)}</div>
                  <div className="text-2xs text-text-tertiary">缓存创建</div>
                </div>
              </div>
            </div>
          )}
          {overview.topModels.length > 0 && (
            <div className="border border-border-default bg-surface-card rounded-lg p-4">
              <div className="flex items-center gap-2 text-2xs text-text-tertiary mb-3">
                <Cpu size={13} />
                模型分布
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overview.topModels.slice(0, 8).map((m) => (
                  <span key={m.name} className="px-2 py-1 rounded-md bg-indigo-50 text-2xs text-indigo-700">
                    {m.name} · {m.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top tools, skills & subagents */}
      {overview && (overview.topTools.length > 0 || overview.topSkills.length > 0 || overview.topSubagents.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {overview.topTools.length > 0 && (
            <div className="border border-border-default bg-surface-card rounded-lg p-4">
              <div className="flex items-center gap-2 text-2xs text-text-tertiary mb-3">
                <Terminal size={13} />
                常用工具 TOP 8
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overview.topTools.slice(0, 8).map((t) => (
                  <span key={t.name} className="px-2 py-1 rounded-md bg-surface-base text-2xs text-text-secondary">
                    {t.name} · {t.count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {overview.topSkills.length > 0 && (
            <div className="border border-border-default bg-surface-card rounded-lg p-4">
              <div className="flex items-center gap-2 text-2xs text-text-tertiary mb-3">
                <Activity size={13} />
                常用技能
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overview.topSkills.slice(0, 8).map((s) => (
                  <span key={s.name} className="px-2 py-1 rounded-md bg-purple-50 text-2xs text-purple-700">
                    {s.name} · {s.count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {overview.topSubagents.length > 0 && (
            <div className="border border-border-default bg-surface-card rounded-lg p-4">
              <div className="flex items-center gap-2 text-2xs text-text-tertiary mb-3">
                <Activity size={13} />
                子代理
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overview.topSubagents.slice(0, 8).map((s) => (
                  <span key={s.name} className="px-2 py-1 rounded-md bg-teal-50 text-2xs text-teal-700">
                    {s.name} · {s.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project cards */}
      <div>
        <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <FolderOpen size={15} />
          项目分布
          <span className="text-2xs font-normal text-text-tertiary">{projects.length} 个项目</span>
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {projects.map((project) => (
            <ProjectCard key={project.projectPath ?? '__unknown__'} project={project} onClick={() => onSelectProject(project.projectPath)} />
          ))}
          {projects.length === 0 && !loading && (
            <div className="col-span-2 text-sm text-text-tertiary py-8 text-center">未发现本地会话文件</div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<any>; label: string; value: number | string }) {
  return (
    <div className="border border-border-default bg-surface-card rounded-lg p-4">
      <div className="flex items-center gap-2 text-text-tertiary text-2xs">
        <Icon size={13} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-text-primary">{value}</div>
    </div>
  )
}

function ProjectCard({ project, onClick }: { project: ApiProjectSessionOverview; onClick: () => void }) {
  const name = project.projectPath
    ? project.projectPath.split('/').filter(Boolean).slice(-2).join('/')
    : '未知项目'

  return (
    <button
      onClick={onClick}
      className="w-full text-left border border-border-default bg-surface-card rounded-lg p-4 hover:border-accent-blue/40 hover:bg-surface-hover transition-colors"
    >
      <div className="flex items-center gap-2">
        <FolderOpen size={15} className="text-accent-blue shrink-0" />
        <span className="text-sm font-medium text-text-primary truncate">{name}</span>
        <span className="ml-auto text-2xs text-text-tertiary shrink-0">{project.sessionCount} 个会话</span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-2xs text-text-tertiary">
        <span>{project.messageCount} 消息</span>
        <span>{project.toolCallCount} 工具</span>
        <span>{formatBytes(project.totalSizeBytes)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-2xs text-text-tertiary">
        {project.agentBreakdown.claude > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700">Claude {project.agentBreakdown.claude}</span>
        )}
        {project.agentBreakdown.codex > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">Codex {project.agentBreakdown.codex}</span>
        )}
        {project.lastActiveAt && (
          <span className="ml-auto inline-flex items-center gap-1">
            <Clock size={10} />
            {new Date(project.lastActiveAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {project.topTools.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {project.topTools.slice(0, 4).map((t) => (
            <span key={t.name} className="px-1.5 py-0.5 rounded bg-surface-base text-2xs text-text-tertiary">
              {t.name}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}
