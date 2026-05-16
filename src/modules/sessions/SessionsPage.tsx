import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ApiProjectSessionOverview,
  ApiSessionAgent,
  ApiSessionDetail,
  ApiSessionOverview,
  ApiSessionRole,
  ApiSessionSearchHit,
  ApiSessionSummary,
} from '@/core/api'
import { api } from '@/core/api'
import { useAppStore } from '@/store'
import { OverviewDashboard } from './OverviewDashboard'
import { ProjectSidebar } from './ProjectSidebar'
import { ConversationViewer } from './ConversationViewer'
import { SessionStatsPanel } from './SessionAnalytics'
import { MessageNavigator } from './MessageNavigator'

type MainView = 'overview' | 'conversation'
type ResizePane = 'left' | 'right'

const MIN_LEFT_WIDTH = 220
const MAX_LEFT_WIDTH = 460
const MIN_RIGHT_WIDTH = 180
const MAX_RIGHT_WIDTH = 360

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function SessionsPage({ agentId }: { agentId: ApiSessionAgent }) {
  const { pushToast } = useAppStore()

  const [overview, setOverview] = useState<ApiSessionOverview | null>(null)
  const [projects, setProjects] = useState<ApiProjectSessionOverview[]>([])
  const [sessions, setSessions] = useState<ApiSessionSummary[]>([])
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<ApiSessionSummary | null>(null)
  const [detail, setDetail] = useState<ApiSessionDetail | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ApiSessionSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [roleFilter, setRoleFilter] = useState<ApiSessionRole | 'all'>('all')
  const [showTools, setShowTools] = useState(true)
  const [leftWidth, setLeftWidth] = useState(280)
  const [rightWidth, setRightWidth] = useState(220)

  const mainView: MainView = selectedSession ? 'conversation' : 'overview'
  const detailTokenRef = useRef(0)

  useEffect(() => {
    setSelectedSession(null)
    setDetail(null)
    setSelectedProjectPath(null)
    setSessions([])
    setOverview(null)
    setProjects([])
    setQuery('')
    setHits([])
  }, [agentId])

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true)
    try {
      const [nextOverview, nextProjects] = await Promise.all([
        api.sessions.overview({ agent: agentId, scope: 'user' }),
        api.sessions.projects({ agent: agentId, scope: 'all' }),
      ])
      setOverview(nextOverview)
      setProjects(nextProjects)
    } catch (error) {
      pushToast({ kind: 'error', message: `概览加载失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setLoadingOverview(false)
    }
  }, [agentId, pushToast])

  const loadSessions = useCallback(async (projectPath: string | null) => {
    setLoadingSessions(true)
    try {
      const params = projectPath
        ? { agent: agentId, projectPath, scope: 'current-project' as const }
        : { agent: agentId, scope: 'all' as const }
      setSessions(await api.sessions.list(params))
    } catch (error) {
      pushToast({ kind: 'error', message: `会话列表加载失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setLoadingSessions(false)
    }
  }, [agentId, pushToast])

  const loadDetail = useCallback(async (session: ApiSessionSummary, pagination?: { offset?: number; limit?: number }) => {
    const token = ++detailTokenRef.current
    setLoadingDetail(true)
    try {
      const nextDetail = await api.sessions.detail(session.agent, session.id, pagination ?? { limit: 50 })
      if (token !== detailTokenRef.current) return
      setDetail(nextDetail)
    } catch (error) {
      if (token !== detailTokenRef.current) return
      pushToast({ kind: 'error', message: `读取会话失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      if (token === detailTokenRef.current) setLoadingDetail(false)
    }
  }, [pushToast])

  useEffect(() => { loadOverview() }, [loadOverview])
  useEffect(() => { loadSessions(selectedProjectPath) }, [selectedProjectPath, loadSessions])

  // ── Search ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!query.trim()) { setHits([]); return }
    const timer = window.setTimeout(() => {
      setSearching(true)
      api.sessions.search({ agent: agentId, scope: 'all', query })
        .then(setHits)
        .catch((error) => pushToast({ kind: 'error', message: `搜索失败：${error instanceof Error ? error.message : String(error)}` }))
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [agentId, query, pushToast])

  // ── Actions ───────────────────────────────────────────────────────────────

  const selectProject = (path: string | null) => {
    setSelectedProjectPath(path)
    setSelectedSession(null)
    setDetail(null)
  }

  const selectSession = (session: ApiSessionSummary) => {
    setSelectedSession(session)
    loadDetail(session)
  }

  const openSearchHit = (hit: ApiSessionSearchHit) => {
    setSelectedSession(hit.session)
    loadDetail(hit.session).then(() => {
      setTimeout(() => document.getElementById(`msg-${hit.messageId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 200)
    })
  }

  const backToOverview = () => {
    setSelectedSession(null)
    setDetail(null)
  }

  const deleteSession = async () => {
    if (!selectedSession) return
    if (!window.confirm(`删除会话到 cc-steward 回收区？\n\n${selectedSession.path}`)) return
    try {
      const result = await api.sessions.delete(selectedSession.agent, selectedSession.id)
      pushToast({ kind: 'success', message: `已移动到回收区：${result.trashPath}` })
      backToOverview()
      loadSessions(selectedProjectPath)
      loadOverview()
    } catch (error) {
      pushToast({ kind: 'error', message: `删除失败：${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const copyPath = async () => {
    if (!detail) return
    await navigator.clipboard?.writeText(detail.path)
    pushToast({ kind: 'success', message: '路径已复制' })
  }

  const loadPage = (offset: number) => {
    if (!selectedSession) return
    loadDetail(selectedSession, { offset, limit: 50 })
  }

  const startResize = (pane: ResizePane, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const startX = event.clientX
    const startLeft = leftWidth
    const startRight = rightWidth
    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX
      if (pane === 'left') {
        setLeftWidth(clamp(startLeft + delta, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH))
      } else {
        setRightWidth(clamp(startRight - delta, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH))
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: projects + sessions */}
      <ProjectSidebar
        agentId={agentId}
        width={leftWidth}
        projects={projects}
        sessions={sessions}
        selectedProjectPath={selectedProjectPath}
        selectedSessionId={selectedSession?.id ?? null}
        loadingSessions={loadingSessions}
        query={query}
        hits={hits}
        searching={searching}
        onQueryChange={setQuery}
        onSelectProject={selectProject}
        onSelectSession={selectSession}
        onOpenHit={openSearchHit}
      />

      <ResizeHandle side="left" onPointerDown={(event) => startResize('left', event)} />

      {/* Main content */}
      <div className="flex-1 overflow-auto min-w-0">
        {mainView === 'overview' && (
          <OverviewDashboard
            agentId={agentId}
            overview={overview}
            projects={projects}
            loading={loadingOverview}
            onSelectProject={selectProject}
          />
        )}
        {mainView === 'conversation' && (
          <ConversationViewer
            detail={detail}
            loading={loadingDetail}
            roleFilter={roleFilter}
            showTools={showTools}
            onRoleFilter={setRoleFilter}
            onToggleTools={() => setShowTools((v) => !v)}
            onDelete={deleteSession}
            onCopyPath={copyPath}
            onBack={backToOverview}
            onLoadPage={loadPage}
          />
        )}
      </div>

      {/* Right sidebar: stats + navigator (only in conversation view) */}
      {mainView === 'conversation' && detail && (
        <>
          <ResizeHandle side="right" onPointerDown={(event) => startResize('right', event)} />
          <div className="shrink-0 bg-surface-base overflow-auto p-3 space-y-4" style={{ width: rightWidth }}>
            <SessionStatsPanel stats={detail.stats} />
            <MessageNavigator
              messages={detail.messages}
              roleFilter={roleFilter}
              onRoleFilter={setRoleFilter}
              onJump={(id) => document.getElementById(`msg-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            />
          </div>
        </>
      )}
    </div>
  )
}

function ResizeHandle({
  side,
  onPointerDown,
}: {
  side: 'left' | 'right'
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="拖动调整区域宽度"
      onPointerDown={onPointerDown}
      className={`group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-border-default/70 hover:bg-accent-blue/40 transition-colors ${
        side === 'left' ? 'border-x border-border-subtle' : 'border-x border-border-subtle'
      }`}
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border-default group-hover:bg-accent-blue" />
    </div>
  )
}
