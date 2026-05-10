/**
 * Renderer-side bridge to Electron preload APIs.
 * Falls back gracefully when running in a plain browser (no `window.cct`).
 */

interface CctBridge {
  platform: NodeJS.Platform
  isElectron: true
  revealInFinder: (path: string) => Promise<void>
  openFile: (path: string) => Promise<void>
  openInTerminal: (dirPath: string) => Promise<void>
  pickDirectory: (defaultPath?: string) => Promise<string | null>
}

declare global {
  interface Window {
    cct?: CctBridge
  }
}

export const isElectron = typeof window !== 'undefined' && !!window.cct?.isElectron

export const electronApi = {
  isElectron,

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
