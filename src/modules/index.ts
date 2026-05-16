/**
 * Module registrations — order determines sidebar position.
 * To add a new module: import its definition and call moduleRegistry.register()
 */
import { moduleRegistry } from '@/core/module-registry'
import { overviewModule }                    from './overview'
import { claudeConfigModule, codexConfigModule } from './agent-config'
import { sessionsModule }                    from './sessions'
import { syncModule }                        from './sync'
import { helpModule }                        from './help'
import { settingsModule }                    from './settings'
// Legacy modules kept as hidden routes (accessible by direct URL)
import { configFilesModule }  from './config-files'
import { activeConfigModule } from './active-config'
import { pathMappingModule }  from './path-mapping'

// ── Main nav ─────────────────────────────────────────────────────────────────
moduleRegistry.register(overviewModule)

// 配置管理 section (grouped under "配置管理" header)
moduleRegistry.register(claudeConfigModule)
moduleRegistry.register(codexConfigModule)
moduleRegistry.register(sessionsModule)

// Tools
moduleRegistry.register(syncModule)

// Bottom nav
moduleRegistry.register(settingsModule)
moduleRegistry.register(helpModule)

// ── Hidden legacy routes (no sidebar entry) ───────────────────────────────────
moduleRegistry.register({ ...configFilesModule,  showInNav: false })
moduleRegistry.register({ ...activeConfigModule, showInNav: false })
moduleRegistry.register({ ...pathMappingModule,  showInNav: false })

export {
  overviewModule,
  claudeConfigModule,
  codexConfigModule,
  sessionsModule,
  syncModule,
  helpModule,
  settingsModule,
}
