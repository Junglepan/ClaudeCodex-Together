import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ToastHost } from '@/components/ui/Toast'
import { moduleRegistry } from '@/core/module-registry'
import { useAppStore } from '@/store'
import { api } from '@/core/api'
import { useShortcuts } from '@/hooks/useShortcuts'
import { agentRegistry } from '@/core/agent-registry'

import '@/agents/index'
import '@/modules/index'

function GlobalShortcuts() {
  const navigate = useNavigate()
  const { setRefreshing, setAgentSummaries, setAgentFiles, projectPath, refreshing, pushToast, setError, toggleSidebar } = useAppStore()

  const refreshAll = async () => {
    if (refreshing) return
    setRefreshing(true)
    setError(null)
    try {
      const summaries = await api.agents.list(projectPath)
      setAgentSummaries(summaries)
      const all = agentRegistry.getAll()
      const lists = await Promise.all(all.map((a) => api.agents.files(a.id, projectPath)))
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

  useShortcuts([
    { key: 'r', meta: true, handler: refreshAll },
    { key: 'b', meta: true, handler: toggleSidebar },
    { key: 'slash', handler: () => {
      const el = document.querySelector<HTMLInputElement>('input[type="text"][placeholder*="搜索"], input[type="text"][placeholder*="搜"]')
      el?.focus(); el?.select()
    }},
    { key: '1', meta: true, handler: () => navigate('/overview') },
    { key: '2', meta: true, handler: () => navigate('/files') },
    { key: '3', meta: true, handler: () => navigate('/sync') },
  ])
  return null
}

function buildRouter() {
  const modules = moduleRegistry.getAll()
  return createBrowserRouter([
    {
      path: '/',
      element: <ShellWithShortcuts />,
      children: [
        { index: true, element: <Navigate to={modules[0]?.path ?? '/overview'} replace /> },
        ...modules.map((mod) => ({
          path: mod.path.replace(/^\//, ''),
          element: <mod.Component />,
        })),
      ],
    },
  ])
}

function ShellWithShortcuts() {
  return (
    <>
      <GlobalShortcuts />
      <AppShell />
    </>
  )
}

export function App() {
  const { setProjectPath, setPlatform, setError } = useAppStore()

  useEffect(() => {
    let cancelled = false
    const tryMeta = async (attempt = 0) => {
      try {
        const d = await api.meta()
        if (cancelled) return
        if (d.project_path) setProjectPath(d.project_path)
        if (d.platform) setPlatform(d.platform)
      } catch (e) {
        if (cancelled) return
        // Backend may still be starting (Electron spawns it asynchronously).
        // Retry a few times with backoff before giving up.
        if (attempt < 8) {
          setTimeout(() => tryMeta(attempt + 1), Math.min(300 * 2 ** attempt, 3000))
        } else {
          setError(`无法连接后端：${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
    tryMeta()
    return () => { cancelled = true }
  }, [setProjectPath, setPlatform, setError])

  const router = buildRouter()

  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>
  )
}
