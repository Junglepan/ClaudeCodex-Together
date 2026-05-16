import { Bot, Terminal } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { SessionsPage } from './SessionsPage'

function ClaudeSessionsPage() {
  return <SessionsPage agentId="claude" />
}

function CodexSessionsPage() {
  return <SessionsPage agentId="codex" />
}

export const claudeSessionsModule: ModuleDefinition = {
  id: 'sessions-claude',
  label: 'Claude',
  path: '/sessions/claude',
  Icon: Bot,
  group: '会话管理',
  Component: ClaudeSessionsPage,
}

export const codexSessionsModule: ModuleDefinition = {
  id: 'sessions-codex',
  label: 'Codex',
  path: '/sessions/codex',
  Icon: Terminal,
  group: '会话管理',
  Component: CodexSessionsPage,
}
