import { useEffect, useState } from 'react'
import { Copy, FolderOpen } from 'lucide-react'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import { api } from '@/core/api'
import type { ApiConfigFile } from '@/core/api'

interface PathGroup {
  title: string
  subtitle: string
  rows: PathRow[]
}

interface PathRow {
  label: string
  path: string
  exists: boolean
  scope: string
  format: string
  purpose: string
}

export function PathMapping() {
  const { projectPath } = useAppStore()
  const [groups, setGroups] = useState<PathGroup[]>([])
  const [meta, setMeta] = useState<{ project_path: string; home_path: string } | null>(null)

  useEffect(() => {
    // Load meta
    fetch('/api/meta').then(r => r.json()).then(setMeta).catch(console.error)

    // Build path groups from agent files
    Promise.all(
      agentRegistry.getAll().map((agent) =>
        api.agents.files(agent.id, projectPath).then((files) => ({ agent, files }))
      )
    ).then((results) => {
      const built: PathGroup[] = []
      for (const { agent, files } of results) {
        const global = files.filter((f) => f.scope === 'global')
        const project = files.filter((f) => f.scope === 'project')

        if (global.length) {
          built.push({
            title: `${agent.name} — 全局`,
            subtitle: agent.globalDir,
            rows: global.map(toRow),
          })
        }
        if (project.length) {
          built.push({
            title: `${agent.name} — 项目`,
            subtitle: projectPath ?? '当前目录',
            rows: project.map(toRow),
          })
        }
      }
      setGroups(built)
    })
  }, [projectPath])

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">路径映射</h1>
        <p className="mt-1 text-sm text-text-secondary">
          所有 Claude / Codex 配置文件的完整路径一览
        </p>
      </div>

      {/* Context info */}
      {meta && (
        <div className="bg-surface-card border border-border-default rounded-xl p-4 mb-4 flex gap-6 text-sm">
          <div>
            <span className="text-text-tertiary text-xs">项目目录</span>
            <div className="font-mono text-xs text-text-primary mt-0.5">{meta.project_path}</div>
          </div>
          <div>
            <span className="text-text-tertiary text-xs">用户主目录</span>
            <div className="font-mono text-xs text-text-primary mt-0.5">{meta.home_path}</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title} className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle">
              <div className="text-sm font-medium text-text-primary">{group.title}</div>
              <div className="text-2xs text-text-tertiary font-mono mt-0.5">{group.subtitle}</div>
            </div>
            <table className="w-full">
              <tbody>
                {group.rows.map((row) => (
                  <PathRow key={row.label} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}

function toRow(f: ApiConfigFile): PathRow {
  return {
    label: f.label,
    path: f.path,
    exists: f.exists,
    scope: f.scope,
    format: f.format,
    purpose: f.purpose ?? '',
  }
}

function PathRow({ row }: { row: PathRow }) {
  const copy = () => navigator.clipboard?.writeText(row.path)

  return (
    <tr className="border-b border-border-subtle last:border-0 hover:bg-surface-hover group">
      <td className="px-4 py-2.5 w-8">
        <span
          className={`w-1.5 h-1.5 rounded-full inline-block ${
            row.exists ? 'bg-status-active' : 'bg-border-default'
          }`}
        />
      </td>
      <td className="py-2.5 w-40">
        <span className={`text-xs font-medium ${row.exists ? 'text-text-primary' : 'text-text-tertiary'}`}>
          {row.label}
        </span>
      </td>
      <td className="py-2.5 pr-2">
        <span className="text-2xs font-mono text-text-secondary">{row.path}</span>
      </td>
      <td className="py-2.5 pr-4 w-20">
        <span className="text-2xs px-1.5 py-0.5 bg-surface-base rounded text-text-tertiary uppercase">
          {row.format}
        </span>
      </td>
      <td className="py-2.5 pr-4">
        <span className="text-2xs text-text-tertiary line-clamp-1 max-w-xs">{row.purpose}</span>
      </td>
      <td className="py-2.5 pr-4 w-8">
        <button
          onClick={copy}
          className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-text-secondary transition-all"
        >
          <Copy size={12} />
        </button>
      </td>
    </tr>
  )
}
