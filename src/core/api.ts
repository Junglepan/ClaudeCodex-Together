/**
 * Backend API client.
 * In dev/preview mode without a running backend, automatically falls back
 * to mock data so the UI can be previewed standalone.
 */

import {
  mockAgents,
  mockClaudeFiles,
  mockCodexFiles,
  mockSyncPlan,
  mockSyncResult,
  buildMockFileDetail,
  mockMeta,
} from './mock-data'

const BASE = '/api'

// Determine if mock mode is forced (env var) or if backend is unreachable
const FORCE_MOCK = (import.meta as any).env?.VITE_USE_MOCK === 'true'
let useMock: boolean | undefined = FORCE_MOCK ? true : undefined

async function probeBackend(): Promise<boolean> {
  if (useMock !== undefined) return !useMock
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 800)
    const res = await fetch(`${BASE}/health`, { signal: ctrl.signal })
    clearTimeout(timer)
    useMock = !res.ok
    return res.ok
  } catch {
    useMock = true
    console.info('[CCT] Backend unreachable — running in mock mode with sample data.')
    return false
  }
}

async function request<T>(path: string, options?: RequestInit, mockFn?: () => T): Promise<T> {
  const ok = await probeBackend()
  if (!ok && mockFn) {
    // simulate small latency to make UI feel realistic
    await new Promise((r) => setTimeout(r, 120))
    return mockFn()
  }
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    if (mockFn) return mockFn()
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ApiAgentSummary {
  id: string
  name: string
  status: 'active' | 'not_installed' | 'partial'
  global_path: string
  file_count: number
}

export interface ApiConfigFile {
  key: string
  label: string
  path: string
  exists: boolean
  scope: 'global' | 'project'
  kind: 'file' | 'dir'
  format: string
  status: 'active' | 'optional' | 'available' | 'missing'
  size_bytes?: number
  modified_at?: string
  purpose?: string
}

export interface ApiFileDetail {
  path: string
  exists: boolean
  content?: string
  purpose: string
  details: string
  counterpart_agent?: string
  counterpart_path?: string
  counterpart_exists?: boolean
}

export interface ApiSyncPlan {
  items: ApiSyncItem[]
  stats: { migratable: number; needs_conversion: number; conflicts: number; ignored: number }
}

export interface ApiSyncItem {
  status: 'added' | 'check' | 'not_added'
  type: 'Instruction' | 'Skill' | 'Subagent' | 'Hook' | 'MCP' | 'Plugin'
  name: string
  source: string
  target: string
  notes: string
}

export interface ApiSyncResult {
  dry_run: boolean
  items: ApiSyncItem[]
  written: string[]
  skipped: string[]
}

// ── API ──────────────────────────────────────────────────────────────────────

export const api = {
  health: () =>
    request<{ status: string; version: string }>('/health', undefined, () => ({
      status: 'ok',
      version: '0.1.0-mock',
    })),

  meta: () => request<typeof mockMeta>('/meta', undefined, () => mockMeta),

  agents: {
    list: (projectPath?: string) =>
      request<ApiAgentSummary[]>(
        `/agents${projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''}`,
        undefined,
        () => mockAgents,
      ),

    files: (agentId: string, projectPath?: string) =>
      request<ApiConfigFile[]>(
        `/agents/${agentId}/files${projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''}`,
        undefined,
        () => (agentId === 'claude' ? mockClaudeFiles : mockCodexFiles),
      ),
  },

  files: {
    read: (path: string) =>
      request<ApiFileDetail>(`/files/read?path=${encodeURIComponent(path)}`, undefined, () => ({
        path,
        exists: true,
        content: '',
        purpose: '',
        details: '',
      })),

    meta: (agentId: string, fileKey: string, projectPath?: string) =>
      request<ApiFileDetail>(
        `/files/meta?agent=${agentId}&key=${fileKey}${projectPath ? `&project=${encodeURIComponent(projectPath)}` : ''}`,
        undefined,
        () => buildMockFileDetail(agentId, fileKey),
      ),
  },

  sync: {
    plan: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncPlan>(
        '/sync/plan',
        { method: 'POST', body: JSON.stringify({ scope, project_path: projectPath }) },
        () => mockSyncPlan,
      ),

    execute: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false) =>
      request<ApiSyncResult>(
        '/sync/execute',
        {
          method: 'POST',
          body: JSON.stringify({ scope, project_path: projectPath, replace, dry_run: false }),
        },
        () => mockSyncResult,
      ),

    dryRun: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncResult>(
        '/sync/execute',
        {
          method: 'POST',
          body: JSON.stringify({ scope, project_path: projectPath, replace: false, dry_run: true }),
        },
        () => ({ ...mockSyncResult, dry_run: true, written: mockSyncResult.written.map((p) => `[dry-run] ${p}`) }),
      ),
  },
}

// Expose mock-mode flag for UI banner
export function isMockMode(): boolean {
  return useMock === true
}
