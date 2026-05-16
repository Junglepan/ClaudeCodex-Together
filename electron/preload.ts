/**
 * Preload script: secure bridge between renderer (React) and main process.
 * Expose only the minimal APIs needed — no full Node access in renderer.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('cct', {
  platform: process.platform,
  isElectron: true,

  api: (request: { endpoint: string; payload?: Record<string, unknown> }): Promise<unknown> =>
    ipcRenderer.invoke('cct:api', request),

  revealInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('cct:reveal-in-finder', filePath),

  openFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('cct:open-file', filePath),

  openInTerminal: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('cct:open-in-terminal', dirPath),

  pickDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('cct:pick-directory', defaultPath),

  showContextMenu: (items: Array<{ label: string; action: string; enabled?: boolean }>): Promise<string | null> =>
    ipcRenderer.invoke('cct:show-context-menu', items),

  watchPath: (watchPath: string | string[]): Promise<boolean> =>
    ipcRenderer.invoke('cct:watch-path', watchPath),

  unwatch: (): Promise<boolean> =>
    ipcRenderer.invoke('cct:unwatch'),

  // One-way events from main to renderer
  onFsChanged: (cb: (payload: { path: string; file: string | null; event: string }) => void) => {
    ipcRenderer.on('cct:fs-changed', (_e, payload) => cb(payload))
  },
  onSwitchProject: (cb: (newPath: string) => void) => {
    ipcRenderer.on('cct:switch-project', (_e, newPath) => cb(newPath))
  },
  onMenuAction: (cb: (action: string, payload?: unknown) => void) => {
    ipcRenderer.on('cct:menu-refresh',         () => cb('refresh'))
    ipcRenderer.on('cct:menu-toggle-sidebar',  () => cb('toggle-sidebar'))
    ipcRenderer.on('cct:menu-toggle-theme',    () => cb('toggle-theme'))
    ipcRenderer.on('cct:menu-navigate',        (_e, route: string) => cb('navigate', route))
  },
  offAll: () => {
    ipcRenderer.removeAllListeners('cct:fs-changed')
    ipcRenderer.removeAllListeners('cct:switch-project')
    ipcRenderer.removeAllListeners('cct:menu-refresh')
    ipcRenderer.removeAllListeners('cct:menu-toggle-sidebar')
    ipcRenderer.removeAllListeners('cct:menu-toggle-theme')
    ipcRenderer.removeAllListeners('cct:menu-navigate')
  },
})
