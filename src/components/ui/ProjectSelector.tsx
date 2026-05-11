import { useState, useRef, useEffect } from 'react'
import { FolderOpen, ChevronDown, Clock, X, Check } from 'lucide-react'
import { useAppStore } from '@/store'
import { electronApi, isElectron } from '@/lib/electron-bridge'
import { agentRegistry } from '@/core/agent-registry'
import { api } from '@/core/api'
import { withColdStartRetry } from '@/lib/retry'

function basename(p: string) {
  return p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p
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
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setInputMode(false); setInputVal('') }
  }, [open])

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
    // Re-fetch all agent data for the new project
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
      const picked = await electronApi.pickDirectory(projectPath).catch(() => null)
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
  const uniqueRecent = recentProjects.filter((p) => p !== projectPath).slice(0, 8)

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
        <div className="absolute top-full mt-1 left-0 z-50 w-72 bg-white border border-border-default rounded-xl shadow-lg overflow-hidden animate-fade-in">
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

          {/* Recent projects */}
          {uniqueRecent.length > 0 && (
            <div className="py-1 border-b border-border-subtle">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider">最近使用</span>
                <button
                  onClick={() => clearRecentProjects()}
                  className="text-2xs text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-0.5"
                >
                  <X size={9} />清除
                </button>
              </div>
              {uniqueRecent.map((p) => (
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
            </div>
          )}

          {/* Actions */}
          <div className="p-2">
            {inputMode ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitInput(); if (e.key === 'Escape') setInputMode(false) }}
                  placeholder="/path/to/project"
                  className="flex-1 text-xs px-2 py-1.5 border border-border-default rounded-lg font-mono outline-none focus:border-accent-blue"
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
