/**
 * Preload script: secure bridge between renderer (React) and main process.
 * Expose only the minimal APIs needed — no full Node access in renderer.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('cct', {
  platform: process.platform,
  isElectron: true,

  // Reveal a path in macOS Finder / Explorer / file manager
  revealInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('cct:reveal-in-finder', filePath),

  // Open a file with the default app
  openFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('cct:open-file', filePath),

  // Open a directory in the system terminal (cwd = path)
  openInTerminal: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('cct:open-in-terminal', dirPath),

  // Show native directory picker; returns selected path or null if cancelled
  pickDirectory: (defaultPath?: string): Promise<string | null> =>
    ipcRenderer.invoke('cct:pick-directory', defaultPath),
})
