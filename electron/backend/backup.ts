import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { allAgents, scanAgentFiles } from './agents'

export async function exportBackup(project?: string | null) {
  const zip = new JSZip()
  const manifest = [
    '# CCT Backup',
    `created_at: ${new Date().toISOString().slice(0, 19)}`,
    `project: ${project || '-'}`,
    '',
  ]

  for (const agent of allAgents()) {
    for (const file of scanAgentFiles(agent.id, project)) {
      if (!file.exists) continue
      const arcRoot = `${agent.id}/${file.scope}`
      if (file.kind === 'file') {
        try {
          zip.file(`${arcRoot}/${file.key}__${path.basename(file.path)}`, fs.readFileSync(file.path))
          manifest.push(`${arcRoot}/${file.key}__${path.basename(file.path)} <- ${file.path}`)
        } catch (error) {
          manifest.push(`# skip ${file.path}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }

  zip.file('MANIFEST.txt', manifest.join('\n'))
  const data = await zip.generateAsync({ type: 'uint8array' })
  return {
    filename: `cct-backup-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)}.zip`,
    data: Array.from(data),
  }
}
