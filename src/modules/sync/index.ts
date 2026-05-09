import { RefreshCw } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { SyncCenter } from './SyncCenter'

export const syncModule: ModuleDefinition = {
  id: 'sync',
  label: '同步中心',
  path: '/sync',
  Icon: RefreshCw,
  Component: SyncCenter,
}
