import { Settings as SettingsIcon } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { Settings } from './Settings'

export const settingsModule: ModuleDefinition = {
  id: 'settings',
  label: '偏好',
  path: '/settings',
  Icon: SettingsIcon,
  Component: Settings,
}
