import { Activity, Clock, Database, FolderOpen, MessageSquare, Terminal, TrendingUp } from 'lucide-react'
import type { ApiProjectSessionOverview, ApiSessionAgent, ApiSessionOverview } from '@/core/api'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

      {/* Top tools & skills */}
      {overview && (overview.topTools.length > 0 || overview.topSkills.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
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
