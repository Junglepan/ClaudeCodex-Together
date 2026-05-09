import { useEffect, useState } from 'react'
import { Copy, ArrowRight, FileX, Info, Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import { api } from '@/core/api'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import type { ApiFileDetail } from '@/core/api'

interface Props {
  agentId: string
  fileKey: string
}

export function FileDetail({ agentId, fileKey }: Props) {
  const [detail, setDetail]   = useState<ApiFileDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Edit state
  const [editing, setEditing]       = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving]         = useState(false)
  const [saveMsg, setSaveMsg]       = useState<string | null>(null)

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  const { setAgentFiles, projectPath } = useAppStore()
  const agent    = agentRegistry.get(agentId)
  const fileSpec = agent?.configFiles.find((f) => f.key === fileKey)

  const load = () => {
    setLoading(true)
    setError(null)
    setEditing(false)
    setSaveMsg(null)
    api.files.meta(agentId, fileKey)
      .then(setDetail)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [agentId, fileKey])

  const handleSave = async () => {
    if (!detail) return
    setSaving(true)
    try {
      await api.files.write(detail.path, editContent)
      setSaveMsg('已保存')
      setEditing(false)
      load()
      // Refresh file list so status badge updates
      api.agents.files(agentId, projectPath)
        .then((f) => setAgentFiles(agentId, f))
        .catch(console.error)
    } catch (e) {
      setSaveMsg(`保存失败：${e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!detail) return
    setDeleting(true)
    try {
      await api.files.delete(detail.path)
      setConfirmDelete(false)
      load()
      api.agents.files(agentId, projectPath)
        .then((f) => setAgentFiles(agentId, f))
        .catch(console.error)
    } catch (e) {
      setError(`删除失败：${e}`)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <div className="p-6 text-text-tertiary text-sm animate-pulse">加载中…</div>
  if (error)   return <div className="p-6 text-red-500 text-sm">加载失败：{error}</div>
  if (!detail || !fileSpec) return <div className="p-6 text-text-tertiary text-sm">未找到文件定义</div>

  const counterpartAgent = fileSpec.counterpartAgent ? agentRegistry.get(fileSpec.counterpartAgent) : null
  const counterpartSpec  = counterpartAgent?.configFiles.find((f) => f.key === fileSpec.counterpartKey)
  const canEdit = fileSpec.kind === 'file'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border-default flex items-center gap-3 flex-shrink-0 bg-white">
        <span className="font-semibold text-text-primary text-sm">{fileSpec.label}</span>
        <ExistsBadge exists={detail.exists} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-2xs uppercase bg-surface-base px-1.5 py-0.5 rounded text-text-tertiary font-mono">{fileSpec.format}</span>
          <span className="text-2xs text-text-tertiary">{fileSpec.scope === 'global' ? '全局' : '项目'}</span>
          {canEdit && !editing && (
            <>
              <div className="w-px h-3 bg-border-default" />
              <button
                onClick={() => { setEditing(true); setEditContent(detail.content ?? '') }}
                className="flex items-center gap-1.5 text-2xs px-2.5 py-1 rounded-lg border border-border-default hover:bg-surface-hover text-text-secondary transition-colors"
              >
                <Pencil size={11} />
                {detail.exists ? '编辑' : '新建'}
              </button>
              {detail.exists && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-2xs px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-500 transition-colors"
                >
                  <Trash2 size={11} />
                  删除
                </button>
              )}
            </>
          )}
          {editing && (
            <>
              <div className="w-px h-3 bg-border-default" />
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-2xs px-2.5 py-1 rounded-lg bg-accent-blue text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                <Check size={11} />
                {saving ? '保存中…' : '保存'}
              </button>
              <button
                onClick={() => { setEditing(false); setSaveMsg(null) }}
                className="flex items-center gap-1.5 text-2xs px-2.5 py-1 rounded-lg border border-border-default hover:bg-surface-hover text-text-secondary transition-colors"
              >
                <X size={11} />
                取消
              </button>
            </>
          )}
        </div>
      </div>

      {/* Save/delete feedback banners */}
      {saveMsg && (
        <div className={`px-5 py-2 text-xs flex items-center gap-2 ${saveMsg.startsWith('已') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {saveMsg.startsWith('已') ? <Check size={12} /> : <AlertTriangle size={12} />}
          {saveMsg}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="mx-5 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 flex-shrink-0">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">确认删除此文件？</p>
            <p className="text-xs text-red-600 mt-0.5 font-mono">{detail.path}</p>
            <p className="text-xs text-red-600 mt-1">此操作不可撤销。</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? '删除中…' : '确认删除'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-5 space-y-5">

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

        {/* Editor / Content viewer */}
        {editing ? (
          <InfoSection icon="✏️" title="编辑内容">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full h-64 p-3 text-xs font-mono text-text-primary bg-white border border-border-default rounded-lg outline-none focus:border-accent-blue transition-colors resize-y leading-relaxed"
              spellCheck={false}
              placeholder={`在此输入 ${fileSpec.label} 的内容…`}
            />
          </InfoSection>
        ) : detail.exists && detail.content != null ? (
          <InfoSection icon="📄" title="当前内容">
            <ContentViewer content={detail.content} path={detail.path} />
          </InfoSection>
        ) : !detail.exists ? (
          <div className="flex items-start gap-3 p-3 bg-surface-base border border-border-subtle rounded-lg text-xs text-text-tertiary">
            <FileX size={14} className="flex-shrink-0 mt-0.5" />
            <span>文件不存在，尚未创建。点击"新建"按钮可直接在此编辑并保存。</span>
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
          <div className="flex items-start gap-2 p-3 bg-surface-base border border-border-subtle rounded-lg text-xs text-text-tertiary">
            <Info size={13} className="flex-shrink-0 mt-0.5" />
            <span>对应 {fileSpec.counterpartAgent} 的等价文件：{fileSpec.syncStrategy ?? '无迁移策略'}</span>
          </div>
        ) : null}

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const display   = truncated ? content.slice(0, MAX) : content
  const lines     = display.split('\n').length

  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <div className="px-3 py-1.5 bg-surface-base border-b border-border-subtle flex items-center justify-between">
        <span className="text-2xs text-text-tertiary">{lines} 行{truncated ? '（已截断）' : ''}</span>
        <CopyBtn text={content} />
      </div>
      <pre className="p-3 text-xs font-mono text-text-primary overflow-auto max-h-64 leading-relaxed bg-white">
        {display}
        {truncated && <span className="text-text-tertiary">{'\n'}…（内容已截断）</span>}
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

        {syncStrategy && (
          <div className="px-4 pb-3 flex items-start gap-2 text-xs text-text-secondary border-t border-border-subtle pt-3">
            <Info size={13} className="text-accent-blue flex-shrink-0 mt-0.5" />
            {syncStrategy}
          </div>
        )}

        {notInstalled && (
          <div className="px-4 pb-3 border-t border-border-subtle pt-3">
            <div className="flex items-start gap-2 p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
              <Info size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                {targetAgent.shortName} 尚未安装或未初始化，目标路径不存在。安装后再运行同步即可自动创建。
              </span>
            </div>
          </div>
        )}

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
  const [copied, setCopied] = useState(false)
  const handle = () => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handle} className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0">
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
    </button>
  )
}
