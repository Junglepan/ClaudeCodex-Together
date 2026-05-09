/**
 * Module registrations
 * To add a new module: import its definition and call moduleRegistry.register()
 */
import { moduleRegistry } from '@/core/module-registry'
import { overviewModule } from './overview'
import { configFilesModule } from './config-files'
import { syncModule } from './sync'

moduleRegistry.register(overviewModule)
moduleRegistry.register(configFilesModule)
moduleRegistry.register(syncModule)

// Future modules to add here:
// moduleRegistry.register(activeConfigModule)   // 当前生效
// moduleRegistry.register(pathMappingModule)    // 路径映射
// moduleRegistry.register(sessionsModule)       // 会话管理

export { overviewModule, configFilesModule, syncModule }
