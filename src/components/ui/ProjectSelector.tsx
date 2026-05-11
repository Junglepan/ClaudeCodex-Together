import { useState, useRef, useEffect, useCallback } from 'react'
import { FolderOpen, ChevronDown, Clock, X, Check, Loader2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { electronApi, isElectron } from '@/lib/electron-bridge'
import { agentRegistry } from '@/core/agent-registry'
import { api } from '@/core/api'
import type { ApiProject } from '@/core/api'
import { withColdStartRetry } from '@/lib/retry'

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p
}

function SourceBadge({ source }: { source: 'claude' | 'codex' | 'both' }) {
  const map = {
    claude: 'Claude',
    codex: 'Codex',
    both: 'Claude+Codex',
  }
  return (
    <span className="text-2xs font-medium text-text-tertiary bg-surface-base border border-border-default px-1.5 py-0.5 rounded">
      {map[source]}
    </span>
  )
}

export function ProjectSelector() {
  const {
    projectPath, setProjectPath,
    recentProjects, clearRecentProjects,
    setRefreshing, setAgentSummaries, setAgentFiles, pushToast, setError, refreshing,
  } = useAppStore()

  const [open, setOpen] = useState(false)
  const [inputMode, setInputMode] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [discovered, setDiscovered] = useState<ApiProject[]>([])
  const [loadingDiscover, setLoadingDiscover] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const loadDiscovered = useCallback(async () => {
    setLoadingDiscover(true)
    try {
      const list = await api.projects.list()
      setDiscovered(list)
    } catch {
      // backend not available — silently ignore
    } finally {
      setLoadingDiscover(false)
    }
  }, [])

  // Load discovered projects when dropdown opens
  useEffect(() => {
    if (open) {
      loadDiscovered()
    } else {
      setInputMode(false)
      setInputVal('')
    }
  }, [open, loadDiscovered])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const applyProject = async (path: string) => {
    setOpen(false)
    if (path === projectPath) return
    setProjectPath(path)
    if (refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const all = agentRegistry.getAll()
      const [summaries, ...lists] = await withColdStartRetry(() =>
        Promise.all([
          api.agents.list(path),
          ...all.map((a) => api.agents.files(a.id, path)),
        ]),
      )
      setAgentSummaries(summaries)
      all.forEach((a, i) => setAgentFiles(a.id, lists[i]))
      pushToast({ kind: 'success', message: `已切换至 ${basename(path)}` })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      pushToast({ kind: 'error', message: `切换项目失败：${msg}` })
    } finally {
      setRefreshing(false)
    }
  }

  const pickFolder = async () => {
    if (isElectron) {
      const picked = await electronApi.pickDirectory(projectPath ?? undefined).catch(() => null)
      if (picked) applyProject(picked)
    } else {
      setInputMode(true)
    }
  }

  const submitInput = () => {
    const trimmed = inputVal.trim()
    if (trimmed) applyProject(trimmed)
  }

  const label = projectPath ? basename(projectPath) : '未选择项目'

  // Discovered projects not already current, deduplicated vs recents
  const discoveredPaths = new Set(discovered.map((d) => d.path))
  const recentNotDiscovered = recentProjects
    .filter((p) => p !== projectPath && !discoveredPaths.has(p))
    .slice(0, 5)
  const discoveredNotCurrent = discovered.filter((d) => d.path !== projectPath)

  return (
    <div className="relative no-drag" ref={ref}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border-default hover:border-accent-blue/40 hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary"
        title={projectPath ?? '设置项目路径'}
      >
        <FolderOpen size={12} className="text-text-tertiary" />
        <span className="text-xs font-medium max-w-32 truncate">{label}</span>
        <ChevronDown size={10} className="text-text-tertiary flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 w-80 bg-surface-card border border-border-default rounded-xl shadow-lg overflow-hidden animate-fade-in">
          {/* Current */}
          {projectPath && (
            <div className="px-3 py-2.5 border-b border-border-subtle bg-surface-base">
              <div className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">当前项目</div>
              <div className="flex items-center gap-2">
                <Check size={11} className="text-accent-blue flex-shrink-0" />
                <code className="text-xs font-mono text-text-primary truncate flex-1">{projectPath}</code>
              </div>
            </div>
          )}

          {/* Discovered projects */}
          <div className="py-1 border-b border-border-subtle max-h-56 overflow-y-auto">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider">已识别项目</span>
              {loadingDiscover && <Loader2 size={10} className="animate-spin text-text-tertiary" />}
            </div>

            {!loadingDiscover && discoveredNotCurrent.length === 0 && (
              <div className="px-3 py-2 text-2xs text-text-tertiary">
                未发现项目（来自 ~/.codex/config.toml 和 ~/.claude/projects/）
              </div>
            )}

            {discoveredNotCurrent.map((proj) => (
              <button
                key={proj.path}
                onClick={() => applyProject(proj.path)}
                disabled={!proj.exists}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  proj.exists
                    ? 'hover:bg-surface-hover text-text-primary'
                    : 'opacity-50 cursor-not-allowed text-text-tertiary'
                }`}
              >
                <FolderOpen size={11} className="text-text-tertiary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{proj.name}</span>
                    {!proj.exists && <span className="text-2xs text-text-tertiary">(已删除)</span>}
                  </div>
                  <code className="text-2xs font-mono text-text-tertiary truncate block">{proj.path}</code>
                </div>
                <SourceBadge source={proj.source} />
              </button>
            ))}

            {/* Recent projects not in discovered list */}
            {recentNotDiscovered.length > 0 && (
              <>
                <div className="px-3 py-1.5 flex items-center justify-between border-t border-border-subtle mt-1">
                  <span className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider">最近使用</span>
                  <button
                    onClick={() => clearRecentProjects()}
                    className="text-2xs text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-0.5"
                  >
                    <X size={9} />清除
                  </button>
                </div>
                {recentNotDiscovered.map((p) => (
                  <button
                    key={p}
                    onClick={() => applyProject(p)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors text-left"
                  >
                    <Clock size={11} className="text-text-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-text-primary truncate">{basename(p)}</div>
                      <code className="text-2xs font-mono text-text-tertiary truncate block">{p}</code>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="p-2">
            {inputMode ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitInput()
                    if (e.key === 'Escape') setInputMode(false)
                  }}
                  placeholder="/path/to/project"
                  className="flex-1 text-xs px-2 py-1.5 border border-border-default rounded-lg font-mono outline-none focus:border-accent-blue bg-surface-card text-text-primary"
                />
                <button
                  onClick={submitInput}
                  className="px-2.5 py-1.5 bg-accent-blue text-white text-xs rounded-lg hover:bg-accent-blue/90 transition-colors"
                >
                  确认
                </button>
              </div>
            ) : (
              <button
                onClick={pickFolder}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors text-left"
              >
                <FolderOpen size={12} />
                <span className="text-xs">{isElectron ? '选择文件夹…' : '输入路径…'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
