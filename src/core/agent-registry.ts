/**
 * Agent Registry
 *
 * Central registry for all AI agent tool definitions.
 * Adding a new agent (e.g. Cursor, Windsurf) requires only:
 *   1. Create src/agents/<name>.ts implementing AgentDefinition
 *   2. Call agentRegistry.register(def) in src/agents/index.ts
 */

import type { AgentDefinition } from '@/agents/types'

class AgentRegistry {
  private agents = new Map<string, AgentDefinition>()

  register(agent: AgentDefinition) {
    if (this.agents.has(agent.id)) {
      console.warn(`Agent "${agent.id}" is already registered — skipping duplicate.`)
      return
    }
    this.agents.set(agent.id, agent)
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id)
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values())
  }

  getIds(): string[] {
    return Array.from(this.agents.keys())
  }
}

export const agentRegistry = new AgentRegistry()
