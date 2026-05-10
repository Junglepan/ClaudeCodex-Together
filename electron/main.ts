import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const BACKEND_PORT = 8765
const FRONTEND_PORT = 5174

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null

// ── Backend ──────────────────────────────────────────────────────────────────

function startBackend() {
  const backendDir = isDev
    ? path.join(__dirname, '..', 'backend')
    : path.join(process.resourcesPath, 'backend')

  backendProcess = spawn('python3', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)], {
    cwd: backendDir,
    stdio: isDev ? 'inherit' : 'pipe',
  })

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err)
  })

  console.log('Backend started on port', BACKEND_PORT)
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill()
    backendProcess = null
  }
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

function registerIpc() {
  ipcMain.handle('cct:reveal-in-finder', async (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('cct:open-file', async (_e, filePath: string) => {
    const err = await shell.openPath(filePath)
    if (err) throw new Error(err)
  })

  ipcMain.handle('cct:open-in-terminal', async (_e, dirPath: string) => {
    if (process.platform === 'darwin') {
      spawn('open', ['-a', 'Terminal', dirPath])
    } else if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', 'cmd', '/K', `cd /d "${dirPath}"`], { detached: true })
    } else {
      // Try common Linux terminals
      const candidates = ['gnome-terminal', 'konsole', 'xterm']
      for (const cmd of candidates) {
        try {
          spawn(cmd, [`--working-directory=${dirPath}`])
          return
        } catch { /* continue */ }
      }
    }
  })

  ipcMain.handle('cct:pick-directory', async (_e, defaultPath?: string) => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      defaultPath,
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = isDev
    ? path.join(__dirname, '..', 'assets', 'icon.png')
    : path.join(process.resourcesPath, 'assets', 'icon.png')

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 },
    backgroundColor: '#F5F5F7',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const url = isDev
    ? `http://localhost:${FRONTEND_PORT}`
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(url)

  // Open DevTools only when explicitly requested (CC_STEWARD_DEVTOOLS=1; CCT_DEVTOOLS legacy)
  if (isDev && (process.env.CC_STEWARD_DEVTOOLS === '1' || process.env.CCT_DEVTOOLS === '1')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpc()
  startBackend()

  setTimeout(createWindow, isDev ? 0 : 1500)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopBackend()
})
