import { useNavigate } from 'react-router-dom'
import { RefreshCw, Settings, HelpCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAppStore } from '@/store'
import { api } from '@/core/api'
import { agentRegistry } from '@/core/agent-registry'
import { withColdStartRetry } from '@/lib/retry'

const isElectron =
  typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent)

export function TitleBar() {
  const navigate = useNavigate()
  const {
    setAgentFiles, setAgentSummaries, projectPath,
    refreshing, setRefreshing, pushToast, setError,
    sidebarCollapsed, toggleSidebar,
  } = useAppStore()

  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const all = agentRegistry.getAll()
      const [summaries, ...lists] = await withColdStartRetry(() => Promise.all([
        api.agents.list(projectPath),
        ...all.map((a) => api.agents.files(a.id, projectPath)),
      ]))
      setAgentSummaries(summaries)
      all.forEach((a, i) => setAgentFiles(a.id, lists[i]))
      pushToast({ kind: 'success', message: '已刷新' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      pushToast({ kind: 'error', message: `刷新失败：${msg}` })
    } finally {
      setRefreshing(false)
    }
  }

  // Use leading padding to clear macOS native traffic lights (Electron overlays them)
  const leadingPad = isElectron ? 'pl-20' : 'pl-4'

  return (
    <header
      className={`drag-region h-11 flex items-center pr-2 ${leadingPad} border-b border-border-default bg-surface-card select-none flex-shrink-0`}
    >
      {/* Local non-Electron traffic-light placeholder (so the dev browser preview also looks right) */}
      {!isElectron && (
        <div className="flex items-center gap-1.5 mr-4 no-drag">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
      )}

      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
        className="no-drag flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
      >
        {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>

      <h1 className="ml-2 text-sm font-semibold text-text-primary">cc-steward</h1>
      <span className="ml-1.5 text-2xs text-text-tertiary">Claude / Codex 配置管家</span>

      <div className="ml-3 flex items-center gap-1 px-2 py-0.5 border border-border-default rounded-full no-drag">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
        <span className="text-2xs text-text-secondary">仅本地文件</span>
      </div>

      <BackendIndicator />

      <div className="flex-1" />

      <div className="flex items-center gap-1 no-drag">
        <TitleBarButton onClick={refresh} title="刷新 (⌘R)" disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          <span className="text-xs">{refreshing ? '刷新中…' : '刷新'}</span>
        </TitleBarButton>
        <TitleBarButton onClick={() => navigate('/settings')} title="偏好设置">
          <Settings size={14} />
          <span className="text-xs">偏好</span>
        </TitleBarButton>
        <TitleBarButton onClick={() => navigate('/help')} title="帮助">
          <HelpCircle size={14} />
          <span className="text-xs">帮助</span>
        </TitleBarButton>
      </div>
    </header>
  )
}

function BackendIndicator() {
  const { backendHealthy } = useAppStore()
  const tone =
    backendHealthy === null ? { dot: 'bg-text-tertiary', label: '探测中', cls: 'text-text-tertiary border-border-default' }
    : backendHealthy        ? { dot: 'bg-status-active animate-pulse', label: '后端在线', cls: 'text-text-secondary border-border-default' }
    :                         { dot: 'bg-status-error', label: '后端离线', cls: 'text-red-600 border-red-200 bg-red-50' }
  return (
    <div className={`ml-2 flex items-center gap-1 px-2 py-0.5 border rounded-full no-drag ${tone.cls}`} title={tone.label}>
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      <span className="text-2xs">{tone.label}</span>
    </div>
  )
}

function TitleBarButton({
  children, onClick, title, disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
