import os from 'node:os'
import { listAgentSummaries, scanAgentFiles } from './agents'
import { exportBackup } from './backup'
import { resolvedConfig } from './config'
import { deleteFile, fileMeta, readFile, writeFile } from './files'
import { homeDir, projectRoot } from './fsUtils'
import { listProjects } from './projects'
import { syncDryRun, syncExecute, syncPlan, syncScan } from './sync'
import pkg from '../../package.json'

export interface BackendRequest {
  endpoint: string
  payload?: Record<string, unknown>
}

export async function handleBackendRequest(request: BackendRequest): Promise<unknown> {
  const payload = request.payload ?? {}
  switch (request.endpoint) {
    case 'health':
      return { status: 'ok', version: pkg.version }
    case 'meta':
      return {
        project_path: process.env.CC_STEWARD_PROJECT || process.env.CCT_PROJECT || homeDir(),
        home_path: homeDir(),
        platform: `${process.platform === 'darwin' ? 'macOS' : process.platform} ${os.release()}`,
        hostname: os.hostname(),
        python_version: process.version,
      }
    case 'agents.list':
      return listAgentSummaries(payload.project as string | undefined)
    case 'agents.files':
      return scanAgentFiles(payload.agentId as string, payload.project as string | undefined)
    case 'files.meta':
      return fileMeta(payload.agentId as string, payload.key as string, payload.project as string | undefined)
    case 'files.read':
      return readFile(payload.path as string)
    case 'files.write':
      return writeFile(payload.path as string, payload.content as string)
    case 'files.delete':
      return deleteFile(payload.path as string)
    case 'sync.scan':
      return syncScan(payload as any)
    case 'sync.plan':
      return syncPlan(payload as any)
    case 'sync.dryRun':
      return syncDryRun(payload as any)
    case 'sync.execute':
      return syncExecute(payload as any)
    case 'projects.list':
      return listProjects()
    case 'config.resolved':
      return resolvedConfig(payload.agentId as string, payload.project as string | undefined)
    case 'backup.export':
      return exportBackup(payload.project as string | undefined)
    case 'project.root':
      return projectRoot()
    default:
      throw new Error(`Unknown backend endpoint: ${request.endpoint}`)
  }
}
