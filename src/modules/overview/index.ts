import { Home } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { Overview } from './Overview'

export const overviewModule: ModuleDefinition = {
  id: 'overview',
  label: '概览',
  path: '/overview',
  Icon: Home,
  Component: Overview,
}
