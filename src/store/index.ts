import { create } from 'zustand'
import type { ApiAgentSummary, ApiConfigFile } from '@/core/api'

interface SelectedFile {
  agentId: string
  fileKey: string
  path: string
}

interface AppState {
  // Current project directory (default: cwd from backend)
  projectPath: string | undefined
  setProjectPath: (path: string) => void

  // Platform info (OS, hostname)
  platform: string | undefined
  setPlatform: (p: string) => void

  // Agent summaries (from /agents)
  agentSummaries: ApiAgentSummary[]
  setAgentSummaries: (summaries: ApiAgentSummary[]) => void

  // Per-agent file lists (from /agents/:id/files)
  agentFiles: Record<string, ApiConfigFile[]>
  setAgentFiles: (agentId: string, files: ApiConfigFile[]) => void

  // Currently selected file in the file tree
  selectedFile: SelectedFile | null
  setSelectedFile: (f: SelectedFile | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  projectPath: undefined,
  setProjectPath: (path) => set({ projectPath: path }),

  platform: undefined,
  setPlatform: (platform) => set({ platform }),

  agentSummaries: [],
  setAgentSummaries: (agentSummaries) => set({ agentSummaries }),

  agentFiles: {},
  setAgentFiles: (agentId, files) =>
    set((state) => ({ agentFiles: { ...state.agentFiles, [agentId]: files } })),

  selectedFile: null,
  setSelectedFile: (selectedFile) => set({ selectedFile }),
}))
