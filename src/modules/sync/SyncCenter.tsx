import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { api } from '@/core/api'
import { useAppStore } from '@/store'
import type { ApiSyncResult, ApiSyncItem } from '@/core/api'

type Scope = 'all' | 'global' | 'project'

export function SyncCenter() {
  const { projectPath, pushToast } = useAppStore()
  const [scope, setScope] = useState<Scope>('all')
  const [result, setResult] = useState<ApiSyncResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'idle' | 'dry-run' | 'done'>('idle')

  const run = async (dryRun: boolean) => {
    setLoading(true)
    setResult(null)
    try {
      const res = dryRun
        ? await api.sync.dryRun(scope, projectPath)
        : await api.sync.execute(scope, projectPath)
      setResult(res)
      setMode(dryRun ? 'dry-run' : 'done')
      const writtenCount = res.written.length
      pushToast({
        kind: 'success',
        message: dryRun
          ? `预演完成：${writtenCount} 项可写入`
          : `同步完成：写入 ${writtenCount} 项`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      pushToast({ kind: 'error', message: `同步失败：${msg}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">同步中心</h1>
        <p className="mt-1 text-sm text-text-secondary">
          将 Claude Code 的工作习惯（指令、技能、Agent）迁移到 Codex
        </p>
      </div>

      {/* Scope selector */}
      <div className="bg-surface-card border border-border-default rounded-xl p-4 mb-4">
        <div className="text-xs font-medium text-text-secondary mb-3">迁移范围</div>
        <div className="flex gap-2">
          {(['all', 'global', 'project'] as Scope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                scope === s
                  ? 'bg-accent-blue text-white'
                  : 'bg-surface-base text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {{ all: '全部', global: '全局', project: '项目' }[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Migration items info */}
      <div className="bg-surface-card border border-border-default rounded-xl p-4 mb-4">
        <div className="text-xs font-medium text-text-secondary mb-3">迁移对象（按优先级）</div>
        <div className="space-y-2">
          {[
            { label: 'Instructions', desc: 'CLAUDE.md → AGENTS.md', priority: 1 },
            { label: 'Skills', desc: '.claude/skills/** → .agents/skills/', priority: 2 },
            { label: 'Agents', desc: '.claude/agents/ → .codex/agents/', priority: 3 },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-accent-blue/10 text-accent-blue text-2xs flex items-center justify-center font-medium">
                {item.priority}
              </span>
              <span className="text-xs font-medium text-text-primary w-24">{item.label}</span>
              <span className="text-xs text-text-tertiary font-mono">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => run(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-border-default rounded-lg text-sm text-text-secondary hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Dry Run（预演）
        </button>
        <button
          onClick={() => run(false)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          执行同步
        </button>
      </div>

      {/* Report */}
      {result && (
        <div className="bg-surface-card border border-border-default rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">
              迁移报告 {mode === 'dry-run' && <span className="text-xs text-yellow-600 ml-2">[预演模式 — 未实际写入]</span>}
            </span>
            <SyncStats result={result} />
          </div>
          <ReportTable items={result.items} />
        </div>
      )}
    </div>
  )
}

function SyncStats({ result }: { result: ApiSyncResult }) {
  const added = result.items.filter((i) => i.status === 'added').length
  const check = result.items.filter((i) => i.status === 'check').length
  const notAdded = result.items.filter((i) => i.status === 'not_added').length
  return (
    <div className="flex items-center gap-3 text-xs text-text-tertiary">
      <span className="text-green-600">{added} Added</span>
      <span className="text-yellow-600">{check} Check</span>
      <span className="text-gray-500">{notAdded} Not Added</span>
    </div>
  )
}

function ReportTable({ items }: { items: ApiSyncItem[] }) {
  if (items.length === 0)
    return <p className="px-4 py-6 text-sm text-text-tertiary text-center">没有可迁移的项目</p>

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border-subtle">
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary w-32">Status</th>
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">Item</th>
          <th className="text-left px-4 py-2 text-xs font-medium text-text-tertiary">Notes</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover">
            <td className="px-4 py-2.5">
              <StatusCell status={item.status} />
            </td>
            <td className="px-4 py-2.5 text-xs">
              <span className="font-mono text-text-tertiary">`{item.type}`</span>{' '}
              <span className="text-text-primary">{item.name}</span>
            </td>
            <td className="px-4 py-2.5 text-xs text-text-secondary">{item.notes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StatusCell({ status }: { status: string }) {
  if (status === 'added')
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-700">
        <CheckCircle size={13} /> Added
      </span>
    )
  if (status === 'check')
    return (
      <span className="flex items-center gap-1.5 text-xs text-yellow-700">
        <AlertCircle size={13} /> Check before using
      </span>
    )
  return (
    <span className="flex items-center gap-1.5 text-xs text-gray-500">
      <XCircle size={13} /> Not Added
    </span>
  )
}
