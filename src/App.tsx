import { useCallback, useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { ToastHost } from '@/components/ui/Toast'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { ShortcutHelpOverlay } from '@/components/ui/ShortcutHelpOverlay'
import { moduleRegistry } from '@/core/module-registry'
import { useAppStore } from '@/store'
import { api } from '@/core/api'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useTheme } from '@/hooks/useTheme'
import { agentRegistry } from '@/core/agent-registry'
import { withColdStartRetry } from '@/lib/retry'
import { electronApi, isElectron } from '@/lib/electron-bridge'

import '@/agents/index'
import '@/modules/index'

function GlobalShortcuts({
  onOpenPalette,
  onOpenShortcuts,
}: {
  onOpenPalette: () => void
  onOpenShortcuts: () => void
}) {
  const navigate = useNavigate()
  const {
    setRefreshing, setAgentSummaries, setAgentFiles,
    projectPath, refreshing, pushToast, setError, toggleSidebar,
  } = useAppStore()

  const refreshAll = useCallback(async () => {
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
  }, [refreshing, projectPath, setRefreshing, setAgentSummaries, setAgentFiles, pushToast, setError])

  // Custom events: refresh + sidebar toggle + navigate (from menu or Electron IPC)
  useEffect(() => {
    const onRefresh = () => refreshAll()
    const onToggleSidebar = () => toggleSidebar()
    const onNavigate = (e: Event) => {
      const route = (e as CustomEvent<string>).detail
      if (route) navigate(route)
    }
    window.addEventListener('cct:refresh', onRefresh)
    window.addEventListener('cct:toggle-sidebar', onToggleSidebar)
    window.addEventListener('cct:navigate', onNavigate)
    return () => {
      window.removeEventListener('cct:refresh', onRefresh)
      window.removeEventListener('cct:toggle-sidebar', onToggleSidebar)
      window.removeEventListener('cct:navigate', onNavigate)
    }
  }, [refreshAll, toggleSidebar, navigate])

  useShortcuts([
    { key: 'k', meta: true, handler: onOpenPalette, ignoreInInput: false },
    { key: '?',           handler: onOpenShortcuts },
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

function ShellWithGlobals() {
  const [paletteOpen, setPaletteOpen]     = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  return (
    <>
      <GlobalShortcuts
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      <AppShell />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutHelpOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  )
}

function buildRouter() {
  const modules = moduleRegistry.getAll()
  return createBrowserRouter([
    {
      path: '/',
      element: <ShellWithGlobals />,
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

export function App() {
  const { setProjectPath, setPlatform, setError, setBackendHealthy, projectPath } = useAppStore()
  useTheme()

  // Initial meta load + retry while backend is starting
  useEffect(() => {
    let cancelled = false
    const tryMeta = async (attempt = 0) => {
      try {
        const d = await api.meta()
        if (cancelled) return
        if (d.project_path) setProjectPath(d.project_path)
        if (d.platform) setPlatform(d.platform)
        setBackendHealthy(true)
      } catch (e) {
        if (cancelled) return
        if (attempt < 8) {
          setTimeout(() => tryMeta(attempt + 1), Math.min(300 * 2 ** attempt, 3000))
        } else {
          setBackendHealthy(false)
          setError(`无法连接后端：${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
    tryMeta()
    return () => { cancelled = true }
  }, [setProjectPath, setPlatform, setError, setBackendHealthy])

  // Electron: register menu action + fs-watcher event listeners
  useEffect(() => {
    if (!isElectron) return
    electronApi.onMenuAction((action, payload) => {
      if (action === 'refresh')         window.dispatchEvent(new Event('cct:refresh'))
      if (action === 'toggle-sidebar')  window.dispatchEvent(new Event('cct:toggle-sidebar'))
      if (action === 'navigate')        window.dispatchEvent(new CustomEvent('cct:navigate', { detail: payload }))
    })
    electronApi.onSwitchProject((newPath) => {
      setProjectPath(newPath)
      window.dispatchEvent(new Event('cct:refresh'))
    })
    electronApi.onFsChanged(() => {
      window.dispatchEvent(new Event('cct:refresh'))
    })
    return () => electronApi.offAll()
  }, [setProjectPath])

  // Electron: start watching the project config dirs when projectPath changes
  useEffect(() => {
    if (!isElectron || !projectPath) return
    electronApi.watchPath(projectPath).catch(() => {/* ignore */})
    return () => { electronApi.unwatch().catch(() => {/* ignore */}) }
  }, [projectPath])

  // Heartbeat: ping /health every 5s, update backendHealthy
  useEffect(() => {
    let cancelled = false
    const tick = async () => {
      try {
        await api.health()
        if (!cancelled) setBackendHealthy(true)
      } catch {
        if (!cancelled) setBackendHealthy(false)
      }
    }
    const id = setInterval(tick, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [setBackendHealthy])

  const router = buildRouter()

  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>
  )
}
