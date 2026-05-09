import { useEffect, useState } from 'react'
import { Copy, ExternalLink, ArrowRight } from 'lucide-react'
import { api } from '@/core/api'
import { agentRegistry } from '@/core/agent-registry'
import type { ApiFileDetail } from '@/core/api'

interface Props {
  agentId: string
  fileKey: string
}

export function FileDetail({ agentId, fileKey }: Props) {
  const [detail, setDetail] = useState<ApiFileDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const agent = agentRegistry.get(agentId)
  const fileSpec = agent?.configFiles.find((f) => f.key === fileKey)

  useEffect(() => {
    setLoading(true)
    api.files.meta(agentId, fileKey)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [agentId, fileKey])

  if (loading) {
    return (
      <div className="p-6 text-text-tertiary text-sm animate-pulse">加载中…</div>
    )
  }

  if (!detail || !fileSpec) {
    return <div className="p-6 text-text-tertiary text-sm">无法加载文件详情</div>
  }

  const counterpartAgent = fileSpec.counterpartAgent
    ? agentRegistry.get(fileSpec.counterpartAgent)
    : null
  const counterpartSpec = counterpartAgent?.configFiles.find(
    (f) => f.key === fileSpec.counterpartAgent
  )

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-default flex items-center gap-3">
        <span className="font-semibold text-text-primary">{fileSpec.label}</span>
        {detail.exists ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            活跃中
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
            不存在
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Metadata grid */}
        <MetaGrid detail={detail} fileSpec={fileSpec} />

        {/* Purpose */}
        <Section icon="🛡" title="作用说明">
          <p className="text-sm text-text-secondary leading-relaxed">{fileSpec.purpose}</p>
        </Section>

        {/* How it works */}
        <Section icon="⚙" title="生效原理">
          <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
            {fileSpec.details}
          </pre>
        </Section>

        {/* File content preview */}
        {detail.exists && detail.content && (
          <Section icon="📄" title="当前内容">
            <div className="bg-gray-50 border border-border-default rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
                <span className="text-2xs text-text-tertiary font-mono">{detail.path}</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(detail.content ?? '')}
                  className="text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <Copy size={12} />
                </button>
              </div>
              <pre className="p-3 text-xs font-mono text-text-primary overflow-auto max-h-48 leading-relaxed">
                {detail.content.length > 1500
                  ? detail.content.slice(0, 1500) + '\n… (内容已截断)'
                  : detail.content}
              </pre>
            </div>
          </Section>
        )}

        {/* Counterpart / sync */}
        {counterpartAgent && (
          <Section icon="🔄" title="配置同步（基于 Codex 迁移策略）">
            <div className="border border-border-default rounded-xl overflow-hidden">
              {/* Source → Target */}
              <div className="p-4 flex items-center gap-3">
                <div className="flex-1 bg-surface-base rounded-lg px-3 py-2">
                  <div className="text-2xs text-text-tertiary mb-1">
                    {agent?.shortName}（源）
                  </div>
                  <div className="text-xs font-mono text-text-primary truncate">{detail.path}</div>
                </div>
                <ArrowRight size={16} className="text-text-tertiary flex-shrink-0" />
                <div className="flex-1 bg-surface-base rounded-lg px-3 py-2">
                  <div className="text-2xs text-text-tertiary mb-1">
                    {counterpartAgent.shortName}（目标）
                  </div>
                  <div className="text-xs font-mono text-text-primary truncate">
                    {detail.counterpart_path ?? '—'}
                  </div>
                </div>
              </div>

              {fileSpec.syncStrategy && (
                <div className="px-4 pb-3 flex items-start gap-2">
                  <span className="text-2xs text-accent-blue mt-0.5">ⓘ</span>
                  <span className="text-xs text-text-secondary">{fileSpec.syncStrategy}</span>
                </div>
              )}

              {/* Sync preview stats — placeholder */}
              <div className="border-t border-border-subtle px-4 py-3">
                <div className="text-2xs text-text-tertiary mb-2">同步预览</div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: '可迁移项', value: '—' },
                    { label: '需要转换', value: '—' },
                    { label: '冲突项', value: '—' },
                    { label: '忽略项', value: '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-sm font-semibold text-text-primary">{value}</div>
                      <div className="text-2xs text-text-tertiary">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sync button */}
              <div className="border-t border-border-subtle px-4 py-3 flex justify-end">
                <button className="text-xs px-4 py-1.5 bg-accent-blue text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1.5">
                  <span>开始同步</span>
                </button>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

function MetaGrid({
  detail,
  fileSpec,
}: {
  detail: ApiFileDetail
  fileSpec: { path?: string; format: string }
}) {
  const rows = [
    { label: '文件路径', value: detail.path, mono: true, copy: true },
    {
      label: '当前状态',
      value: detail.exists ? '活跃配置（当前生效）' : '文件不存在',
      badge: detail.exists ? 'active' : 'missing',
    },
    { label: '类型', value: fileSpec.format.toUpperCase() + ' 配置文件' },
  ]

  return (
    <div className="border border-border-default rounded-xl overflow-hidden">
      {rows.map((row, i) => (
        <div
          key={row.label}
          className={`flex items-center px-4 py-3 ${i < rows.length - 1 ? 'border-b border-border-subtle' : ''}`}
        >
          <span className="w-24 text-xs text-text-tertiary flex-shrink-0">{row.label}</span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {row.badge === 'active' ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                活跃配置（当前生效）
              </span>
            ) : row.badge === 'missing' ? (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                文件不存在
              </span>
            ) : (
              <span
                className={`text-xs truncate ${row.mono ? 'font-mono text-text-primary' : 'text-text-secondary'}`}
              >
                {row.value}
              </span>
            )}
            {row.copy && row.value && (
              <button
                onClick={() => navigator.clipboard?.writeText(String(row.value))}
                className="ml-auto text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
              >
                <Copy size={12} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Section({
  icon,
  title,
  children,
}: {
  icon: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-medium text-text-primary">{title}</span>
      </div>
      {children}
    </div>
  )
}
