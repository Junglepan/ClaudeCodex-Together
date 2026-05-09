import { useEffect } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { moduleRegistry } from '@/core/module-registry'
import { useAppStore } from '@/store'
import { api } from '@/core/api'

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
        // Default redirect to first module
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

  useEffect(() => {
    api.health()
      .then((data) => {
        if (data.version) console.info('Backend connected, version:', data.version)
      })
      .catch(() => console.warn('Backend not reachable — running in offline mode'))

    // Get project path from backend
    fetch('/api/meta')
      .then((r) => r.json())
      .then((d) => {
        if (d.project_path) setProjectPath(d.project_path)
        if (d.platform) setPlatform(d.platform)
      })
      .catch(() => {})
  }, [setProjectPath, setPlatform])

  const router = buildRouter()

  return <RouterProvider router={router} />
}
