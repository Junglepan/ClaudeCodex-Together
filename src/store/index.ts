import { create } from 'zustand'
import type { ApiAgentSummary, ApiConfigFile } from '@/core/api'

interface SelectedFile {
  agentId: string
  fileKey: string
  path: string
}

interface Toast {
  id: number
  kind: 'success' | 'error' | 'info'
  message: string
}

export type ThemePref = 'light' | 'dark' | 'auto'

interface AppState {
  // Current project directory (default: cwd from backend)
  projectPath: string | undefined
  setProjectPath: (path: string) => void

  // Platform info (OS, hostname)
  platform: string | undefined
  setPlatform: (p: string) => void

  // Sidebar collapsed state (icons-only)
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void

  // Theme preference (persisted)
  theme: ThemePref
  setTheme: (t: ThemePref) => void

  // Agent summaries (from /agents)
  agentSummaries: ApiAgentSummary[]
  setAgentSummaries: (summaries: ApiAgentSummary[]) => void

  // Per-agent file lists (from /agents/:id/files)
  agentFiles: Record<string, ApiConfigFile[]>
  setAgentFiles: (agentId: string, files: ApiConfigFile[]) => void

  // Currently selected file in the file tree
  selectedFile: SelectedFile | null
  setSelectedFile: (f: SelectedFile | null) => void

  // Global loading/refresh state
  loading: boolean
  refreshing: boolean
  error: string | null
  setLoading: (v: boolean) => void
  setRefreshing: (v: boolean) => void
  setError: (e: string | null) => void

  // Backend health (null = unknown, true = ok, false = down)
  backendHealthy: boolean | null
  setBackendHealthy: (v: boolean | null) => void

  // Toasts
  toasts: Toast[]
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}

let toastSeq = 0
const PERSISTED_KEYS: Array<keyof AppState> = ['sidebarCollapsed', 'theme']

function loadPersisted(): Partial<AppState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('cct.state')
    if (!raw) return {}
    const obj = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of PERSISTED_KEYS) if (k in obj) out[k as string] = obj[k as string]
    return out as Partial<AppState>
  } catch { return {} }
}

function persist(state: AppState) {
  if (typeof window === 'undefined') return
  try {
    const out: Record<string, unknown> = {}
    for (const k of PERSISTED_KEYS) out[k as string] = state[k]
    localStorage.setItem('cct.state', JSON.stringify(out))
  } catch { /* ignore */ }
}

export const useAppStore = create<AppState>((set, get) => ({
  projectPath: undefined,
  setProjectPath: (path) => set({ projectPath: path }),

  platform: undefined,
  setPlatform: (platform) => set({ platform }),

  sidebarCollapsed: false,
  toggleSidebar: () => {
    set({ sidebarCollapsed: !get().sidebarCollapsed })
    persist(get())
  },
  setSidebarCollapsed: (sidebarCollapsed) => {
    set({ sidebarCollapsed })
    persist(get())
  },

  theme: 'auto',
  setTheme: (theme) => {
    set({ theme })
    persist(get())
  },

  agentSummaries: [],
  setAgentSummaries: (agentSummaries) => set({ agentSummaries }),

  agentFiles: {},
  setAgentFiles: (agentId, files) =>
    set((state) => ({ agentFiles: { ...state.agentFiles, [agentId]: files } })),

  selectedFile: null,
  setSelectedFile: (selectedFile) => set({ selectedFile }),

  loading: false,
  refreshing: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setRefreshing: (refreshing) => set({ refreshing }),
  setError: (error) => set({ error }),

  backendHealthy: null,
  setBackendHealthy: (backendHealthy) => set({ backendHealthy }),

  toasts: [],
  pushToast: (t) => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, t.kind === 'error' ? 5000 : 2800)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),

  ...loadPersisted(),
}))
