import React from 'react'
import type { LucideIcon } from 'lucide-react'

export interface NavGroup {
  label: string
  items: NavItem[]
}

export interface NavItem {
  id: string
  label: string
  path: string
  Icon?: LucideIcon
}

export interface ModuleDefinition {
  id: string
  label: string
  path: string
  Icon: LucideIcon
  // Whether to appear in the sidebar nav (default: true)
  showInNav?: boolean
  // Optional nav sub-items (e.g. per-agent file trees)
  navGroup?: NavGroup
  // The page component rendered in the content area
  Component: React.ComponentType
}
