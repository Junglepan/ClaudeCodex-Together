import type { LucideIcon } from 'lucide-react'

export type FileStatus = 'active' | 'optional' | 'available' | 'missing'
export type FileFormat = 'json' | 'toml' | 'markdown' | 'shell' | 'yaml' | 'dir'
export type FileScope = 'global' | 'project'

export interface ConfigFileSpec {
  key: string
  label: string
  // Path template: use {home} and {project} as placeholders
  pathTemplate: string
  scope: FileScope
  kind: 'file' | 'dir'
  format: FileFormat
  purpose: string
  details: string
  // Key of counterpart file in another agent (for diff/sync view)
  counterpartAgent?: string
  counterpartKey?: string
  syncStrategy?: string
}

export interface AgentDefinition {
  id: string
  name: string
  // Short label used in UI chips
  shortName: string
  description: string
  color: string
  Icon: LucideIcon
  globalDir: string        // e.g. "~/.claude"
  configFiles: ConfigFileSpec[]
  // Hook event types this agent supports
  hookEvents: string[]
}
