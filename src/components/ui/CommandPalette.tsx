import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight, Hash, File, FolderOpen, Keyboard } from 'lucide-react'
import { moduleRegistry } from '@/core/module-registry'
import { agentRegistry } from '@/core/agent-registry'
import { useAppStore } from '@/store'
import { SHORTCUTS } from '@/lib/shortcut-catalog'

interface Item {
  id: string
  group: 'page' | 'file' | 'shortcut'
  label: string
  hint?: string
  Icon: typeof Search
  action: () => void
}

interface Props {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { agentFiles, setSelectedFile, toggleSidebar, pushToast } = useAppStore()

  const [query, setQuery]   = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // Build the full item index every render — cheap; ~30 items
  const items: Item[] = useMemo(() => {
    const out: Item[] = []

    // Pages
    for (const m of moduleRegistry.getAll()) {
      out.push({
        id: `page:${m.id}`,
        group: 'page',
        label: m.label,
        hint: m.path,
        Icon: m.Icon ?? Hash,
        action: () => navigate(m.path),
      })
    }

    // Files (per agent)
    for (const agent of agentRegistry.getAll()) {
      const files = agentFiles[agent.id] ?? []
      for (const f of files) {
        out.push({
          id: `file:${agent.id}:${f.key}`,
          group: 'file',
          label: `${agent.shortName} · ${f.label}`,
          hint: f.path,
          Icon: f.kind === 'dir' ? FolderOpen : File,
          action: () => {
            setSelectedFile({ agentId: agent.id, fileKey: f.key, path: f.path })
            navigate(`/config/${agent.id}`)
          },
        })
      }
    }

    // Shortcuts (treat as actions where possible)
    out.push({
      id: 'cmd:toggle-sidebar',
      group: 'shortcut',
      label: '折叠/展开侧栏',
      hint: '⌘ B',
      Icon: Keyboard,
      action: () => toggleSidebar(),
    })
    out.push({
      id: 'cmd:refresh',
      group: 'shortcut',
      label: '刷新数据',
      hint: '⌘ R',
      Icon: Keyboard,
      action: () => {
        // Trigger via custom event so App's GlobalShortcuts handles it
        window.dispatchEvent(new CustomEvent('cct:refresh'))
        pushToast({ kind: 'info', message: '正在刷新…' })
      },
    })
    for (const s of SHORTCUTS) {
      if (s.id === 'sidebar' || s.id === 'refresh') continue
      out.push({
        id: `cmd:${s.id}`,
        group: 'shortcut',
        label: s.label,
        hint: `${s.scope} · ${s.keys}`,
        Icon: Keyboard,
        action: () => { /* informational */ },
      })
    }

    return out
  }, [agentFiles, navigate, setSelectedFile, toggleSidebar, pushToast])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    const score = (it: Item) => {
      const hay = `${it.label} ${it.hint ?? ''}`.toLowerCase()
      if (hay.startsWith(q)) return 3
      if (hay.includes(q))   return 2
      return q.split('').every((c) => hay.includes(c)) ? 1 : 0
    }
    return items
      .map((it) => ({ it, s: score(it) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it)
  }, [items, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') {
        e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); setActive((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[active]
        if (item) { item.action(); onClose() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, active, onClose])

  // Scroll active into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[90vw] bg-surface-card border border-border-default rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <Search size={16} className="text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            placeholder="搜索页面、文件、命令…"
            className="flex-1 text-sm text-text-primary bg-transparent outline-none placeholder:text-text-tertiary"
          />
          <kbd className="text-2xs font-mono px-1.5 py-0.5 bg-surface-base border border-border-default rounded text-text-tertiary">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[420px] overflow-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-text-tertiary">没有匹配项</div>
          ) : (
            <GroupedList items={filtered} active={active} setActive={setActive} onPick={(it) => { it.action(); onClose() }} />
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-border-subtle text-2xs text-text-tertiary">
          <span className="flex items-center gap-1"><kbd className="font-mono px-1 bg-surface-base rounded">↑↓</kbd> 选择</span>
          <span className="flex items-center gap-1"><kbd className="font-mono px-1 bg-surface-base rounded">↵</kbd> 执行</span>
          <span className="flex items-center gap-1"><kbd className="font-mono px-1 bg-surface-base rounded">Esc</kbd> 关闭</span>
          <span className="ml-auto">{filtered.length} 项</span>
        </div>
      </div>
    </div>
  )
}

function GroupedList({
  items, active, setActive, onPick,
}: {
  items: Item[]
  active: number
  setActive: (i: number) => void
  onPick: (it: Item) => void
}) {
  const groups: { label: string; ids: number[] }[] = [
    { label: '页面',   ids: [] },
    { label: '配置文件', ids: [] },
    { label: '命令',   ids: [] },
  ]
  items.forEach((it, i) => {
    if (it.group === 'page')     groups[0].ids.push(i)
    else if (it.group === 'file') groups[1].ids.push(i)
    else                          groups[2].ids.push(i)
  })

  return (
    <>
      {groups.filter((g) => g.ids.length > 0).map((g) => (
        <div key={g.label}>
          <div className="px-4 pt-2 pb-1 text-2xs font-semibold text-text-tertiary uppercase tracking-wider">{g.label}</div>
          {g.ids.map((i) => {
            const it = items[i]
            const isActive = i === active
            return (
              <button
                key={it.id}
                data-index={i}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(it)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  isActive ? 'bg-accent-blue/10' : 'hover:bg-surface-hover'
                }`}
              >
                <it.Icon size={14} className={isActive ? 'text-accent-blue' : 'text-text-tertiary'} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${isActive ? 'text-accent-blue' : 'text-text-primary'}`}>{it.label}</div>
                  {it.hint && <div className="text-2xs text-text-tertiary font-mono truncate">{it.hint}</div>}
                </div>
                {isActive && <ArrowRight size={12} className="text-accent-blue" />}
              </button>
            )
          })}
        </div>
      ))}
    </>
  )
}
