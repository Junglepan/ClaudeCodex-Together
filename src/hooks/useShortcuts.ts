import { useEffect } from 'react'

type Handler = (e: KeyboardEvent) => void

interface Binding {
  /** Lower-case letter, or special name like 'slash', 'escape'. */
  key: string
  /** True = require Cmd (mac) / Ctrl (win/linux). */
  meta?: boolean
  shift?: boolean
  handler: Handler
  /** Skip when focus is inside an input/textarea (default true). */
  ignoreInInput?: boolean
}

function isInInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useShortcuts(bindings: Binding[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      for (const b of bindings) {
        const wantMeta = !!b.meta
        const hasMeta = e.metaKey || e.ctrlKey
        if (wantMeta !== hasMeta) continue
        if (b.shift !== undefined && b.shift !== e.shiftKey) continue
        const key = e.key.toLowerCase()
        const target = b.key.toLowerCase()
        const matches =
          key === target ||
          (target === 'slash' && key === '/') ||
          (target === 'escape' && key === 'escape')
        if (!matches) continue
        if ((b.ignoreInInput ?? true) && isInInput(e.target) && target !== 'escape') continue
        e.preventDefault()
        b.handler(e)
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bindings])
}
