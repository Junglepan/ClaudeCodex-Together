import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { OverviewStats } from './SessionAnalytics'
import { ProjectSessionsOverview } from './ProjectSessionsOverview'
import { SessionDetail } from './SessionDetail'
import { SessionList } from './SessionList'
import { SessionSearch } from './SessionSearch'

type AgentFilter = ApiSessionAgent | 'all'
type ScopeFilter = 'current-project' | 'all'

export function SessionsPage() {
  const { projectPath, pushToast } = useAppStore()
  const [agent, setAgent] = useState<AgentFilter>('all')
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [sessions, setSessions] = useState<ApiSessionSummary[]>([])
  const [projects, setProjects] = useState<ApiProjectSessionOverview[]>([])
  const [overview, setOverview] = useState<ApiSessionOverview | null>(null)
  const [selected, setSelected] = useState<ApiSessionSummary | null>(null)
  const [detail, setDetail] = useState<ApiSessionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ApiSessionSearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const [roleFilter, setRoleFilter] = useState<ApiSessionRole | 'all'>('all')
  const [showTools, setShowTools] = useState(true)

  const effectiveProject = selectedProject ?? (scope === 'current-project' ? projectPath : undefined)
  const apiAgent = agent === 'all' ? undefined : agent

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const listParams = { agent: apiAgent, projectPath: effectiveProject, scope }
      const overviewParams = effectiveProject
        ? { agent: apiAgent, projectPath: effectiveProject, scope: 'project' as const }
        : { agent: apiAgent, scope: 'user' as const }
      const [nextSessions, nextProjects, nextOverview] = await Promise.all([
        api.sessions.list(listParams),
        api.sessions.projects({ agent: apiAgent, scope: 'all' }),
        api.sessions.overview(overviewParams),
      ])
      setSessions(nextSessions)
      setProjects(nextProjects)
      setOverview(nextOverview)
      setSelected((current) => current && nextSessions.some((session) => session.id === current.id) ? current : nextSessions[0] ?? null)
    } catch (error) {
      pushToast({ kind: 'error', message: `会话加载失败：${error instanceof Error ? error.message : String(error)}` })
    } finally {
      setLoading(false)
    }
  }, [apiAgent, effectiveProject, scope, pushToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selected) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    api.sessions.detail(selected.agent, selected.id)
      .then((nextDetail) => { if (!cancelled) setDetail(nextDetail) })
      .catch((error) => pushToast({ kind: 'error', message: `读取会话失败：${error instanceof Error ? error.message : String(error)}` }))
      .finally(() => { if (!cancelled) setLoadingDetail(false) })
    return () => { cancelled = true }
  }, [selected, pushToast])

  useEffect(() => {
    if (!query.trim()) {
      setHits([])
      return
    }
    const timer = window.setTimeout(() => {
      setSearching(true)
      api.sessions.search({ agent: apiAgent, projectPath: effectiveProject, scope, query })
        .then(setHits)
        .catch((error) => pushToast({ kind: 'error', message: `搜索失败：${error instanceof Error ? error.message : String(error)}` }))
        .finally(() => setSearching(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [apiAgent, effectiveProject, scope, query, pushToast])

  const openHit = (hit: ApiSessionSearchHit) => {
    setSelected(hit.session)
    setTimeout(() => document.getElementById(`message-${hit.messageId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }

  const deleteSelected = async () => {
    if (!selected) return
    const confirmed = window.confirm(`删除会话到 cc-steward 回收区？\n\n${selected.path}`)
    if (!confirmed) return
    try {
      const result = await api.sessions.delete(selected.agent, selected.id)
      pushToast({ kind: 'success', message: `已移动到回收区：${result.trashPath}` })
      setSelected(null)
      setDetail(null)
      await load()
    } catch (error) {
      pushToast({ kind: 'error', message: `删除失败：${error instanceof Error ? error.message : String(error)}` })
    }
  }

  const copyPath = async () => {
    if (!detail) return
    await navigator.clipboard?.writeText(detail.path)
    pushToast({ kind: 'success', message: '路径已复制' })
  }

  const filteredSessions = useMemo(() => sessions, [sessions])

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="mb-5 flex items-start gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">会话管理</h1>
          <p className="mt-1 text-sm text-text-secondary">按项目检索本地 Claude / Codex 会话，查看消息、统计和清理历史文件。</p>
        </div>
        {loading && <span className="ml-auto text-2xs text-text-tertiary">刷新中</span>}
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <Segmented value={agent} values={['all', 'claude', 'codex']} labels={{ all: '全部', claude: 'Claude', codex: 'Codex' }} onChange={(value) => setAgent(value as AgentFilter)} />
        <Segmented value={scope} values={['all', 'current-project']} labels={{ all: '全部项目', 'current-project': '当前项目' }} onChange={(value) => setScope(value as ScopeFilter)} />
      </div>

      <div className="space-y-4">
        <OverviewStats overview={overview} />
        <SessionSearch query={query} onQueryChange={setQuery} hits={hits} searching={searching} onOpenHit={openHit} />

        <div className="grid grid-cols-[330px_1fr] gap-4 min-w-0">
          <div className="space-y-4">
            <ProjectSessionsOverview projects={projects} selectedProject={selectedProject} onSelectProject={setSelectedProject} />
            <SessionList sessions={filteredSessions} selectedId={selected?.id ?? null} onSelect={setSelected} />
          </div>
          <SessionDetail
            detail={detail}
            loading={loadingDetail}
            roleFilter={roleFilter}
            showTools={showTools}
            onRoleFilter={setRoleFilter}
            onToggleTools={() => setShowTools((value) => !value)}
            onDelete={deleteSelected}
            onCopyPath={copyPath}
          />
        </div>
      </div>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  values,
  labels,
  onChange,
}: {
  value: T
  values: T[]
  labels: Record<T, string>
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-1 p-1 bg-surface-card border border-border-default rounded-lg">
      {values.map((item) => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`px-3 py-1.5 rounded-md text-xs transition-colors ${value === item ? 'bg-accent-blue text-white' : 'text-text-secondary hover:bg-surface-hover'}`}
        >
          {labels[item]}
        </button>
      ))}
    </div>
  )
}
