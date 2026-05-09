import { Bot, Terminal } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { AgentConfigPage } from './AgentConfigPage'

// Wrapper components so each agent gets its own route component
function ClaudeConfigPage() {
  return AgentConfigPage({ agentId: 'claude' })
}

function CodexConfigPage() {
  return AgentConfigPage({ agentId: 'codex' })
}

export const claudeConfigModule: ModuleDefinition = {
  id: 'config-claude',
  label: 'Claude',
  path: '/config/claude',
  Icon: Bot,
  group: '配置管理',
  Component: ClaudeConfigPage,
}

export const codexConfigModule: ModuleDefinition = {
  id: 'config-codex',
  label: 'Codex',
  path: '/config/codex',
  Icon: Terminal,
  group: '配置管理',
  Component: CodexConfigPage,
}
