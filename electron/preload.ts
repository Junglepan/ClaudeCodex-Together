/**
 * Preload script: secure bridge between renderer (React) and main process.
 * Expose only the minimal APIs needed — no full Node access in renderer.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('cct', {
  // Platform info
  platform: process.platform,

  // Open a path in the system file manager
  revealInFinder: (filePath: string) =>
    ipcRenderer.send('reveal-in-finder', filePath),

  // Open a file with the default app
  openFile: (filePath: string) =>
    ipcRenderer.send('open-file', filePath),
})
