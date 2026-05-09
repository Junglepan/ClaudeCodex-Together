import { FileText } from 'lucide-react'
import type { ModuleDefinition } from '@/modules/types'
import { ConfigFiles } from './ConfigFiles'

export const configFilesModule: ModuleDefinition = {
  id: 'config-files',
  label: '配置文件',
  path: '/config-files',
  Icon: FileText,
  Component: ConfigFiles,
}
