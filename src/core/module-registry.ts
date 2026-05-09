/**
 * Module Registry
 *
 * Central registry for all feature modules (Overview, ConfigFiles, Sync, etc.).
 * Adding a new module requires only:
 *   1. Create src/modules/<name>/index.ts implementing ModuleDefinition
 *   2. Call moduleRegistry.register(def) in src/modules/index.ts
 */

import type { ModuleDefinition } from '@/modules/types'

class ModuleRegistry {
  private modules = new Map<string, ModuleDefinition>()
  private order: string[] = []

  register(mod: ModuleDefinition) {
    if (this.modules.has(mod.id)) {
      console.warn(`Module "${mod.id}" is already registered — skipping duplicate.`)
      return
    }
    this.modules.set(mod.id, mod)
    this.order.push(mod.id)
  }

  get(id: string): ModuleDefinition | undefined {
    return this.modules.get(id)
  }

  // Returns modules in registration order (controls sidebar order)
  getAll(): ModuleDefinition[] {
    return this.order.map((id) => this.modules.get(id)!).filter(Boolean)
  }

  // Returns only nav-visible modules
  getNavItems(): ModuleDefinition[] {
    return this.getAll().filter((m) => m.showInNav !== false)
  }
}

export const moduleRegistry = new ModuleRegistry()
