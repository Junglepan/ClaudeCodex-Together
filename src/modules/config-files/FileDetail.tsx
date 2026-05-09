import { useEffect, useState } from 'react'
import { Copy, ArrowRight, FileX, Info } from 'lucide-react'
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
  const [error, setError] = useState<string | null>(null)

  const agent = agentRegistry.get(agentId)
  const fileSpec = agent?.configFiles.find((f) => f.key === fileKey)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.files.meta(agentId, fileKey)
      .then(setDetail)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [agentId, fileKey])

  if (loading) return <div className="p-6 text-text-tertiary text-sm animate-pulse">加载中…</div>
  if (error)   return <div className="p-6 text-red-500 text-sm">加载失败：{error}</div>
  if (!detail || !fileSpec) return <div className="p-6 text-text-tertiary text-sm">未找到文件定义</div>

  const counterpartAgent = fileSpec.counterpartAgent ? agentRegistry.get(fileSpec.counterpartAgent) : null
  const counterpartSpec  = counterpartAgent?.configFiles.find((f) => f.key === fileSpec.counterpartKey)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-default flex items-center gap-3 flex-shrink-0">
        <span className="font-semibold text-text-primary">{fileSpec.label}</span>
        <ExistsBadge exists={detail.exists} />
        <div className="ml-auto flex items-center gap-2 text-2xs text-text-tertiary">
          <span className="uppercase bg-surface-base px-1.5 py-0.5 rounded">{fileSpec.format}</span>
          <span>{fileSpec.scope === 'global' ? '全局' : '项目'}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* File path */}
        <div className="flex items-center gap-2 bg-surface-base border border-border-subtle rounded-lg px-3 py-2">
          <span className="text-2xs text-text-tertiary flex-shrink-0">路径</span>
          <span className="text-xs font-mono text-text-primary flex-1 truncate">{detail.path}</span>
          <CopyBtn text={detail.path} />
        </div>

        {/* Purpose */}
        <InfoSection icon="🛡" title="作用说明">
          <p className="text-sm text-text-secondary leading-relaxed">{fileSpec.purpose}</p>
        </InfoSection>

        {/* How it works */}
        <InfoSection icon="⚙" title="生效原理">
          <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans bg-surface-base border border-border-subtle rounded-lg p-3">
            {fileSpec.details}
          </pre>
        </InfoSection>

        {/* File content */}
        {detail.exists && detail.content != null ? (
          <InfoSection icon="📄" title="当前内容">
            <ContentViewer content={detail.content} path={detail.path} />
          </InfoSection>
        ) : !detail.exists ? (
          <div className="flex items-start gap-3 p-3 bg-surface-base border border-border-subtle rounded-lg text-xs text-text-tertiary">
            <FileX size={14} className="flex-shrink-0 mt-0.5" />
            <span>文件不存在，尚未创建</span>
          </div>
        ) : null}

        {/* Counterpart / sync */}
        {counterpartAgent && counterpartSpec ? (
          <CounterpartSection
            sourceAgent={agent!.shortName}
            sourcePath={detail.path}
            targetAgent={counterpartAgent}
            targetPath={detail.counterpart_path}
            targetExists={detail.counterpart_exists ?? false}
            syncStrategy={fileSpec.syncStrategy}
          />
        ) : fileSpec.counterpartAgent ? (
          // counterpart agent defined but not registered
          <div className="flex items-start gap-2 p-3 bg-surface-base border border-border-subtle rounded-lg text-xs text-text-tertiary">
            <Info size={13} className="flex-shrink-0 mt-0.5" />
            <span>对应 {fileSpec.counterpartAgent} 的等价文件：{fileSpec.syncStrategy ?? '无迁移策略'}</span>
          </div>
        ) : null}

      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ExistsBadge({ exists }: { exists: boolean }) {
  return exists ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">活跃</span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">不存在</span>
  )
}

function InfoSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-medium text-text-primary">{title}</span>
      </div>
      {children}
    </div>
  )
}

function ContentViewer({ content, path }: { content: string; path: string }) {
  const MAX = 2000
  const truncated = content.length > MAX
  const display = truncated ? content.slice(0, MAX) : content
  const lines = display.split('\n').length

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-surface-base border-b border-border-subtle flex items-center justify-between">
        <span className="text-2xs text-text-tertiary">{lines} 行{truncated ? `（已截断，原文件更长）` : ''}</span>
        <CopyBtn text={content} />
      </div>
      <pre className="p-3 text-xs font-mono text-text-primary overflow-auto max-h-64 leading-relaxed bg-white">
        {display}
        {truncated && <span className="text-text-tertiary">\n…（内容已截断）</span>}
      </pre>
    </div>
  )
}

function CounterpartSection({
  sourceAgent,
  sourcePath,
  targetAgent,
  targetPath,
  targetExists,
  syncStrategy,
}: {
  sourceAgent: string
  sourcePath: string
  targetAgent: ReturnType<typeof agentRegistry.get>
  targetPath?: string | null
  targetExists: boolean
  syncStrategy?: string
}) {
  if (!targetAgent) return null

  const notInstalled = !targetExists && !targetPath

  return (
    <InfoSection icon="🔄" title="配置同步">
      <div className="border border-border-default rounded-xl overflow-hidden">
        {/* Source → Target */}
        <div className="p-4 flex items-center gap-3">
          <PathBox label={`${sourceAgent}（源）`} path={sourcePath} exists />
          <ArrowRight size={16} className="text-text-tertiary flex-shrink-0" />
          <PathBox
            label={`${targetAgent.shortName}（目标）`}
            path={targetPath ?? '目标路径'}
            exists={targetExists}
            notInstalled={notInstalled}
          />
        </div>

        {/* Strategy note */}
        {syncStrategy && (
          <div className="px-4 pb-3 flex items-start gap-2 text-xs text-text-secondary border-t border-border-subtle pt-3">
            <Info size={13} className="text-accent-blue flex-shrink-0 mt-0.5" />
            {syncStrategy}
          </div>
        )}

        {/* Codex not installed notice */}
        {notInstalled && (
          <div className="px-4 pb-3 border-t border-border-subtle pt-3">
            <div className="flex items-start gap-2 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                {targetAgent.shortName} 尚未安装或未初始化，目标路径不存在。
                安装后再运行同步即可自动创建。
              </span>
            </div>
          </div>
        )}

        {/* Sync button */}
        <div className="border-t border-border-subtle px-4 py-3 flex items-center justify-between">
          <span className="text-2xs text-text-tertiary">
            {targetExists ? '目标文件已存在，同步将覆盖' : '目标文件不存在，同步将新建'}
          </span>
          <button
            className="text-xs px-4 py-1.5 bg-accent-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40"
            disabled={notInstalled}
          >
            前往同步中心 →
          </button>
        </div>
      </div>
    </InfoSection>
  )
}

function PathBox({
  label,
  path,
  exists,
  notInstalled,
}: {
  label: string
  path: string
  exists: boolean
  notInstalled?: boolean
}) {
  return (
    <div className="flex-1 min-w-0 bg-surface-base rounded-lg px-3 py-2">
      <div className="text-2xs text-text-tertiary mb-1">{label}</div>
      <div className={`text-xs font-mono truncate ${notInstalled ? 'text-text-tertiary italic' : 'text-text-primary'}`}>
        {path}
      </div>
      {!notInstalled && (
        <div className={`text-2xs mt-1 ${exists ? 'text-green-600' : 'text-text-tertiary'}`}>
          {exists ? '✓ 已存在' : '○ 尚未创建'}
        </div>
      )}
    </div>
  )
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(text)}
      className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
    >
      <Copy size={12} />
    </button>
  )
}
