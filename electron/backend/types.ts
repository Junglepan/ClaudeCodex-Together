export type AgentId = 'claude' | 'codex'
export type ConfigScope = 'global' | 'project'
export type ConfigKind = 'file' | 'dir'

export interface ConfigFileSpec {
  key: string
  label: string
  pathTemplate: string
  scope: ConfigScope
  kind: ConfigKind
  format: string
  purpose: string
  details: string
  counterpartAgent?: AgentId
  counterpartKey?: string
  syncStrategy?: string
}

export interface ConfigFileResult {
  key: string
  label: string
  path: string
  exists: boolean
  scope: ConfigScope
  kind: ConfigKind
  format: string
  status: 'active' | 'not_installed' | 'partial' | 'optional' | 'available' | 'missing'
  size_bytes?: number
  modified_at?: string
  purpose: string
  details: string
  counterpart_agent?: AgentId
  counterpart_key?: string
  sync_strategy?: string
}

export interface AgentSummary {
  id: AgentId
  name: string
  status: 'active' | 'not_installed' | 'partial'
  global_path: string
  file_count: number
}

export interface ApiProject {
  path: string
  name: string
  exists: boolean
  source: 'claude' | 'codex' | 'both'
  last_used: number | null
}

export interface ResolvedSettingsRow {
  key: string
  value: string
  source: 'global' | 'project' | 'local_override' | 'merged'
  overrides: string[]
}

export interface ResolvedInstruction {
  path: string
  exists: boolean
  order: number
  scope: ConfigScope
}

export interface ResolvedScopeItem {
  name: string
  source: ConfigScope
  overridden_by: 'project' | null
}

export interface ApiResolvedConfig {
  agent: AgentId
  project: string | null
  settings: ResolvedSettingsRow[]
  instructions: ResolvedInstruction[]
  skills: ResolvedScopeItem[]
  agents: ResolvedScopeItem[]
}
