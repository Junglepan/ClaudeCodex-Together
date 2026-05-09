import { Activity } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { ActiveConfig } from './ActiveConfig'

export const activeConfigModule: ModuleDefinition = {
  id: 'active-config',
  label: '当前生效',
  path: '/active-config',
  Icon: Activity,
  Component: ActiveConfig,
}
