import { FolderOpen } from 'lucide-react'
import type { ApiProjectSessionOverview } from '@/core/api'

export function ProjectSessionsOverview({
  projects,
  selectedProject,
  onSelectProject,
}: {
  projects: ApiProjectSessionOverview[]
  selectedProject: string | null
  onSelectProject: (path: string | null) => void
}) {
  return (
    <div className="border border-border-default bg-surface-card rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <FolderOpen size={15} />
          项目概览
        </div>
        <button
          onClick={() => onSelectProject(null)}
          className={`text-2xs px-2 py-1 rounded-md ${selectedProject === null ? 'bg-accent-blue text-white' : 'bg-surface-base text-text-secondary hover:bg-surface-hover'}`}
        >
          全部
        </button>
      </div>
      <div className="max-h-[260px] overflow-auto divide-y divide-border-subtle">
        {projects.length === 0 ? (
          <div className="px-3 py-6 text-sm text-text-tertiary">未发现本地会话</div>
        ) : projects.map((project) => {
          const active = selectedProject === project.projectPath
          return (
            <button
              key={project.projectPath ?? 'unknown'}
              onClick={() => onSelectProject(project.projectPath)}
              className={`w-full text-left px-3 py-2.5 hover:bg-surface-hover ${active ? 'bg-surface-active' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text-primary truncate">{project.projectPath ?? '未知项目'}</span>
                <span className="ml-auto text-2xs text-text-tertiary">{project.sessionCount} 个</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-2xs text-text-tertiary">
                <span>{project.messageCount} 消息</span>
                <span>{project.toolCallCount} 工具</span>
                <span>Claude {project.agentBreakdown.claude}</span>
                <span>Codex {project.agentBreakdown.codex}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
