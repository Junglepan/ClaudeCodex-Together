import { useEffect, useState } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { moduleRegistry } from '@/core/module-registry'
import { useAppStore } from '@/store'
import { api, isMockMode } from '@/core/api'

// Trigger agent and module registrations
import '@/agents/index'
import '@/modules/index'

function buildRouter() {
  const modules = moduleRegistry.getAll()

  return createBrowserRouter([
    {
      path: '/',
      element: <AppShell />,
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
  const { setProjectPath, setPlatform } = useAppStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api.meta().then((d) => {
      if (d.project_path) setProjectPath(d.project_path)
      if (d.platform) setPlatform(d.platform)
      setReady(true)
    }).catch(() => setReady(true))
  }, [setProjectPath, setPlatform])

  const router = buildRouter()

  return (
    <>
      {ready && isMockMode() && <MockBanner />}
      <RouterProvider router={router} />
    </>
  )
}

function MockBanner() {
  return (
    <div className="fixed top-2 right-4 z-50 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-full text-2xs text-yellow-800 font-medium shadow-sm flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
      演示模式 · 数据为示例
    </div>
  )
}
