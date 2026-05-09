/**
 * Backend API client
 * All requests go through /api (proxied to FastAPI on port 8765 in dev).
 */

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Agent endpoints ──────────────────────────────────────────────────────────

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

// ── API functions ────────────────────────────────────────────────────────────

export const api = {
  health: () => request<{ status: string; version: string }>('/health'),

  agents: {
    list: (projectPath?: string) =>
      request<ApiAgentSummary[]>(`/agents${projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''}`),

    files: (agentId: string, projectPath?: string) =>
      request<ApiConfigFile[]>(
        `/agents/${agentId}/files${projectPath ? `?project=${encodeURIComponent(projectPath)}` : ''}`
      ),
  },

  files: {
    read: (path: string) =>
      request<ApiFileDetail>(`/files/read?path=${encodeURIComponent(path)}`),

    meta: (agentId: string, fileKey: string, projectPath?: string) =>
      request<ApiFileDetail>(
        `/files/meta?agent=${agentId}&key=${fileKey}${projectPath ? `&project=${encodeURIComponent(projectPath)}` : ''}`
      ),
  },

  sync: {
    plan: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncPlan>('/sync/plan', {
        method: 'POST',
        body: JSON.stringify({ scope, project_path: projectPath }),
      }),

    execute: (scope: 'global' | 'project' | 'all', projectPath?: string, replace = false) =>
      request<ApiSyncResult>('/sync/execute', {
        method: 'POST',
        body: JSON.stringify({ scope, project_path: projectPath, replace, dry_run: false }),
      }),

    dryRun: (scope: 'global' | 'project' | 'all', projectPath?: string) =>
      request<ApiSyncResult>('/sync/execute', {
        method: 'POST',
        body: JSON.stringify({ scope, project_path: projectPath, replace: false, dry_run: true }),
      }),
  },
}
