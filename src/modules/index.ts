/**
 * Module registrations — order determines sidebar position.
 * To add a new module: import its definition and call moduleRegistry.register()
 */
import { moduleRegistry } from '@/core/module-registry'
import { overviewModule }     from './overview'
import { configFilesModule }  from './config-files'
import { activeConfigModule } from './active-config'
import { pathMappingModule }  from './path-mapping'
import { syncModule }         from './sync'
import { helpModule }         from './help'

moduleRegistry.register(overviewModule)
moduleRegistry.register(configFilesModule)
moduleRegistry.register(activeConfigModule)
moduleRegistry.register(pathMappingModule)
moduleRegistry.register(syncModule)
moduleRegistry.register(helpModule)

export {
  overviewModule,
  configFilesModule,
  activeConfigModule,
  pathMappingModule,
  syncModule,
  helpModule,
}
