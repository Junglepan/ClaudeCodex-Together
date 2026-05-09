import { HelpCircle } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { Help } from './Help'

export const helpModule: ModuleDefinition = {
  id: 'help',
  label: '说明',
  path: '/help',
  Icon: HelpCircle,
  Component: Help,
}
