/**
 * Agent registrations
 * To add a new agent: import its definition and call agentRegistry.register()
 */
import { agentRegistry } from '@/core/agent-registry'
import { claudeAgent } from './claude'
import { codexAgent } from './codex'

agentRegistry.register(claudeAgent)
agentRegistry.register(codexAgent)

export { claudeAgent, codexAgent }
