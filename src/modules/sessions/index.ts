import { MessagesSquare } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { SessionsPage } from './SessionsPage'

export const sessionsModule: ModuleDefinition = {
  id: 'sessions',
  label: '会话管理',
  path: '/sessions',
  Icon: MessagesSquare,
  Component: SessionsPage,
}
