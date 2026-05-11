import { useEffect } from 'react'
import { X } from 'lucide-react'
import { SHORTCUTS } from '@/lib/shortcut-catalog'

interface Props {
  open: boolean
  onClose: () => void
}

export function ShortcutHelpOverlay({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const groups = ['全局', '编辑器', '搜索框'] as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-[90vw] bg-surface-card border border-border-default rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-text-primary">键盘快捷键</h3>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-secondary transition-colors"
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-auto">
          {groups.map((scope) => {
            const items = SHORTCUTS.filter((s) => s.scope === scope)
            if (items.length === 0) return null
            return (
              <div key={scope}>
                <div className="text-2xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">{scope}</div>
                <div className="bg-surface-base/50 border border-border-subtle rounded-xl divide-y divide-border-subtle overflow-hidden">
                  {items.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="text-xs font-medium text-text-primary flex-1">{s.label}</span>
                      <kbd className="text-2xs font-mono px-2 py-1 bg-surface-card border border-border-default rounded text-text-secondary">{s.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-2 border-t border-border-subtle flex items-center justify-between text-2xs text-text-tertiary">
          <span>按 <kbd className="font-mono px-1 bg-surface-base rounded">?</kbd> 或 <kbd className="font-mono px-1 bg-surface-base rounded">Esc</kbd> 关闭</span>
        </div>
      </div>
    </div>
  )
}
