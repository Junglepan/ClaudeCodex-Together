import { useEffect, useCallback } from 'react'
import { api } from '@/core/api'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import { withColdStartRetry } from '@/lib/retry'

/**
 * Loads agent summaries + per-agent file lists into the global store.
 * Multiple components can call this; fetches deduplicate at the store boundary
 * (each call replaces the cached result, but they're idempotent reads).
 *
 * Cold-start tolerant: when the backend isn't ready yet (vite proxy returns 500
 * / ECONNREFUSED), retries silently with exponential backoff before surfacing
 * an error toast.
 */
export function useAgents(opts: { withFiles?: boolean } = { withFiles: true }) {
  const {
    projectPath,
    agentSummaries,
    agentFiles,
    setAgentSummaries,
    setAgentFiles,
    setLoading,
    setError,
    setRefreshing,
    pushToast,
  } = useAppStore()

  const fetchAll = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const [summaries, ...fileResults] = await withColdStartRetry(() => Promise.all([
          api.agents.list(projectPath),
          ...(opts.withFiles
            ? agentRegistry.getAll().map((a) => api.agents.files(a.id, projectPath))
            : []),
        ]))
        setAgentSummaries(summaries)
        if (opts.withFiles) {
          agentRegistry.getAll().forEach((a, i) => {
            setAgentFiles(a.id, fileResults[i] as Awaited<ReturnType<typeof api.agents.files>>)
          })
        }
        if (silent) pushToast({ kind: 'success', message: '已刷新' })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        pushToast({ kind: 'error', message: `刷新失败：${msg}` })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [projectPath, opts.withFiles, setAgentSummaries, setAgentFiles, setLoading, setRefreshing, setError, pushToast],
  )

  useEffect(() => { fetchAll() }, [fetchAll])

  return {
    summaries: agentSummaries,
    filesByAgent: agentFiles,
    refresh: () => fetchAll({ silent: true }),
  }
}

/** Fetches just one agent's files (for AgentConfigPage). */
export function useAgentFiles(agentId: string) {
  const { projectPath, agentFiles, setAgentFiles, setError, pushToast, setRefreshing } = useAppStore()

  const refresh = useCallback(
    async ({ silent = true } = {}) => {
      if (silent) setRefreshing(true)
      try {
        const files = await withColdStartRetry(() => api.agents.files(agentId, projectPath))
        setAgentFiles(agentId, files)
        if (silent) pushToast({ kind: 'success', message: '已刷新' })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        pushToast({ kind: 'error', message: `刷新失败：${msg}` })
      } finally {
        setRefreshing(false)
      }
    },
    [agentId, projectPath, setAgentFiles, setError, pushToast, setRefreshing],
  )

  useEffect(() => {
    let cancelled = false
    withColdStartRetry(() => api.agents.files(agentId, projectPath))
      .then((files) => { if (!cancelled) setAgentFiles(agentId, files) })
      .catch((e) => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [agentId, projectPath, setAgentFiles, setError])

  return {
    files: agentFiles[agentId] ?? [],
    refresh,
  }
}
