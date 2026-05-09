import React from 'react'
import type { LucideIcon } from 'lucide-react'

export interface ModuleDefinition {
  id: string
  label: string
  path: string
  Icon: LucideIcon
  // Whether to appear in the sidebar nav (default: true)
  showInNav?: boolean
  // Groups this item under a collapsible section header in the sidebar
  group?: string
  // The page component rendered in the content area
  Component: React.ComponentType
}
