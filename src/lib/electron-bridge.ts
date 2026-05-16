/**
 * Renderer-side bridge to Electron preload APIs.
 * Falls back gracefully when running in a plain browser (no `window.cct`).
 */

interface CctBridge {
  platform: NodeJS.Platform
  isElectron: true
  api: (request: { endpoint: string; payload?: Record<string, unknown> }) => Promise<unknown>
  revealInFinder: (path: string) => Promise<void>
  openFile: (path: string) => Promise<void>
  openInTerminal: (dirPath: string) => Promise<void>
  pickDirectory: (defaultPath?: string) => Promise<string | null>
  showContextMenu: (items: Array<{ label: string; action: string; enabled?: boolean }>) => Promise<string | null>
  watchPath: (path: string | string[]) => Promise<boolean>
  unwatch: () => Promise<boolean>
  onFsChanged: (cb: (payload: { path: string; file: string | null; event: string }) => void) => void
  onSwitchProject: (cb: (newPath: string) => void) => void
  onMenuAction: (cb: (action: string, payload?: unknown) => void) => void
  offAll: () => void
}

declare global {
  interface Window {
    cct?: CctBridge
  }
}

export const isElectron = typeof window !== 'undefined' && !!window.cct?.isElectron

export const electronApi = {
  isElectron,

  async backend<T>(endpoint: string, payload?: Record<string, unknown>): Promise<T> {
    if (!window.cct) throw new Error('Electron backend IPC is unavailable')
    return window.cct.api({ endpoint, payload }) as Promise<T>
  },

  async revealInFinder(p: string) {
    if (!window.cct) throw new Error('Not running in Electron')
    await window.cct.revealInFinder(p)
  },

  async openFile(p: string) {
    if (!window.cct) throw new Error('Not running in Electron')
    await window.cct.openFile(p)
  },

  async openInTerminal(p: string) {
    if (!window.cct) throw new Error('Not running in Electron')
    await window.cct.openInTerminal(p)
  },

  async pickDirectory(defaultPath?: string): Promise<string | null> {
    if (!window.cct) throw new Error('Not running in Electron')
    return window.cct.pickDirectory(defaultPath)
  },

  async showContextMenu(items: Array<{ label: string; action: string; enabled?: boolean }>): Promise<string | null> {
    if (!window.cct) return null
    return window.cct.showContextMenu(items)
  },

  async watchPath(p: string | string[]): Promise<boolean> {
    if (!window.cct) return false
    return window.cct.watchPath(p)
  },

  async unwatch(): Promise<boolean> {
    if (!window.cct) return false
    return window.cct.unwatch()
  },

  onFsChanged(cb: (payload: { path: string; file: string | null; event: string }) => void) {
    window.cct?.onFsChanged(cb)
  },

  onSwitchProject(cb: (newPath: string) => void) {
    window.cct?.onSwitchProject(cb)
  },

  onMenuAction(cb: (action: string, payload?: unknown) => void) {
    window.cct?.onMenuAction(cb)
  },

  offAll() {
    window.cct?.offAll()
  },

  /** Returns 'macOS' / 'Windows' / 'Linux' / 'Web' */
  platformLabel(): string {
    if (!window.cct) return 'Web'
    const p = window.cct.platform
    if (p === 'darwin') return 'macOS'
    if (p === 'win32')  return 'Windows'
    if (p === 'linux')  return 'Linux'
    return p
  },
}
