import { ChevronDown, ChevronRight, Clock, FolderOpen, LayoutDashboard, Search } from 'lucide-react'
import { useState } from 'react'
import type {
  ApiProjectSessionOverview,
  ApiSessionAgent,
  ApiSessionSearchHit,
  ApiSessionSummary,
} from '@/core/api'

export function ProjectSidebar({
  agentId,
  width,
  projects,
  sessions,
  selectedProjectPath,
  selectedSessionId,
  loadingSessions,
  query,
  hits,
  searching,
  onQueryChange,
  onSelectProject,
  onSelectSession,
  onOpenHit,
}: {
  agentId: ApiSessionAgent
  width: number
  projects: ApiProjectSessionOverview[]
  sessions: ApiSessionSummary[]
  selectedProjectPath: string | null
  selectedSessionId: string | null
  loadingSessions: boolean
  query: string
  hits: ApiSessionSearchHit[]
  searching: boolean
  onQueryChange: (q: string) => void
  onSelectProject: (path: string | null) => void
  onSelectSession: (session: ApiSessionSummary) => void
  onOpenHit: (hit: ApiSessionSearchHit) => void
}) {
  const [expandedProject, setExpandedProject] = useState<string | null>(null)

  const toggleProject = (path: string | null) => {
    const key = path ?? '__all__'
    if (expandedProject === key) {
      setExpandedProject(null)
    } else {
      setExpandedProject(key)
      onSelectProject(path)
    }
  }

  const handleSelectProject = (path: string | null) => {
    setExpandedProject(path ?? '__all__')
    onSelectProject(path)
  }

  return (
    <div className="shrink-0 bg-surface-base flex flex-col h-full" style={{ width }}>
      {/* Header */}
      <div className="px-3 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-text-primary">
          {agentId === 'claude' ? 'Claude' : 'Codex'} 会话
        </h2>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface-card border border-border-default rounded-md">
          <Search size={13} className="text-text-tertiary shrink-0" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索会话内容"
            className="flex-1 bg-transparent outline-none text-xs text-text-primary placeholder:text-text-tertiary"
          />
          {searching && <span className="text-2xs text-text-tertiary shrink-0">搜索中</span>}
        </div>
      </div>

      {/* Search results */}
      {query.trim() && (
        <div className="px-3 pb-2">
          <div className="border border-border-default bg-surface-card rounded-md max-h-[200px] overflow-auto">
            {hits.length === 0 ? (
              <div className="px-3 py-3 text-2xs text-text-tertiary">没有匹配结果</div>
            ) : hits.slice(0, 20).map((hit, i) => (
              <button
                key={`${hit.session.id}-${hit.messageId}-${i}`}
                onClick={() => onOpenHit(hit)}
                className="w-full text-left px-3 py-2 hover:bg-surface-hover border-b border-border-subtle last:border-b-0"
              >
                <div className="flex items-center gap-1.5 text-2xs text-text-tertiary">
                  <span className="uppercase">{hit.role}</span>
                  <span className="truncate">{hit.session.title}</span>
                </div>
                <div className="mt-0.5 text-2xs text-text-secondary line-clamp-2">{hit.excerpt}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All sessions button */}
      <div className="px-3 pb-1">
        <button
          onClick={() => handleSelectProject(null)}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors ${
            selectedProjectPath === null
              ? 'bg-accent-blue/10 text-accent-blue font-medium'
              : 'text-text-secondary hover:bg-surface-hover'
          }`}
        >
          <LayoutDashboard size={14} />
          全部会话
          <span className="ml-auto text-2xs text-text-tertiary">
            {projects.reduce((sum, p) => sum + p.sessionCount, 0)}
          </span>
        </button>
      </div>

      {/* Project tree */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        <div className="text-2xs font-medium text-text-tertiary uppercase tracking-wide px-2.5 py-1.5">
          项目
        </div>
        <div className="space-y-0.5">
          {projects.map((project) => {
            const key = project.projectPath ?? '__unknown__'
            const isExpanded = expandedProject === key && selectedProjectPath === project.projectPath
            const isSelected = selectedProjectPath === project.projectPath
            const projectName = project.projectPath
              ? project.projectPath.split('/').filter(Boolean).slice(-2).join('/')
              : '未知项目'

            return (
              <div key={key}>
                <button
                  onClick={() => toggleProject(project.projectPath)}
                  className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs transition-colors ${
                    isSelected
                      ? 'bg-accent-blue/10 text-accent-blue'
                      : 'text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  <FolderOpen size={13} className="shrink-0" />
                  <span className="truncate">{projectName}</span>
                  <span className="ml-auto text-2xs text-text-tertiary shrink-0">{project.sessionCount}</span>
                </button>

                {/* Inline session list */}
                {isExpanded && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {loadingSessions ? (
                      <div className="px-2.5 py-2 text-2xs text-text-tertiary">加载中</div>
                    ) : sessions.length === 0 ? (
                      <div className="px-2.5 py-2 text-2xs text-text-tertiary">没有会话</div>
                    ) : sessions.map((session) => (
                      <SessionTreeItem
                        key={session.id}
                        session={session}
                        active={selectedSessionId === session.id}
                        onClick={() => onSelectSession(session)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SessionTreeItem({ session, active, onClick }: { session: ApiSessionSummary; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
        active ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-surface-hover'
      }`}
    >
      <div className="text-2xs font-medium truncate">{session.title}</div>
      <div className={`mt-0.5 flex items-center gap-2 text-2xs ${active ? 'text-white/70' : 'text-text-tertiary'}`}>
        <span>{session.messageCount} 消息</span>
        <span className="inline-flex items-center gap-0.5">
          <Clock size={9} />
          {formatRelativeTime(session.updatedAt)}
        </span>
      </div>
    </button>
  )
}

function formatRelativeTime(iso: string) {
  const ts = Date.parse(iso)
  if (isNaN(ts)) return '—'
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(iso).toLocaleDateString()
}
