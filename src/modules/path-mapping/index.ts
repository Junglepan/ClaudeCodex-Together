import { Map } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { PathMapping } from './PathMapping'

export const pathMappingModule: ModuleDefinition = {
  id: 'path-mapping',
  label: '路径映射',
  path: '/path-mapping',
  Icon: Map,
  Component: PathMapping,
}
