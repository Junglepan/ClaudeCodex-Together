import { RefreshCw, Settings, HelpCircle } from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/core/api'
import { agentRegistry } from '@/core/agent-registry'

export function TitleBar() {
  const { setAgentFiles, setAgentSummaries, projectPath } = useAppStore()

  const refresh = async () => {
    try {
      const summaries = await api.agents.list(projectPath)
      setAgentSummaries(summaries)
      for (const agent of agentRegistry.getAll()) {
        const files = await api.agents.files(agent.id, projectPath)
        setAgentFiles(agent.id, files)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <header className="h-11 flex items-center px-4 border-b border-border-default bg-surface-card select-none flex-shrink-0">
      {/* macOS traffic-light placeholder (Electron will overlay real ones) */}
      <div className="flex items-center gap-1.5 mr-4">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>

      {/* Title */}
      <h1 className="text-sm font-semibold text-text-primary">Claude / Codex 配置管理</h1>

      {/* Local-only badge */}
      <div className="ml-3 flex items-center gap-1 px-2 py-0.5 border border-border-default rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
        <span className="text-2xs text-text-secondary">仅本地文件</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <TitleBarButton onClick={refresh} title="刷新">
          <RefreshCw size={14} />
          <span className="text-xs">刷新</span>
        </TitleBarButton>
        <TitleBarButton title="偏好设置">
          <Settings size={14} />
          <span className="text-xs">偏好设置</span>
        </TitleBarButton>
        <TitleBarButton title="帮助">
          <HelpCircle size={14} />
          <span className="text-xs">帮助</span>
        </TitleBarButton>
      </div>
    </header>
  )
}

function TitleBarButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
    >
      {children}
    </button>
  )
}
