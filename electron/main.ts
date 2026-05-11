import { app, BrowserWindow, shell, ipcMain, dialog, Menu, MenuItem } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const BACKEND_PORT = 8765
const FRONTEND_PORT = 5174

let mainWindow: BrowserWindow | null = null
let backendProcess: ChildProcess | null = null
let watcherCleanup: (() => void) | null = null

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

  // Context menu for file items in the tree
  ipcMain.handle('cct:show-context-menu', async (_e, items: Array<{ label: string; action: string; enabled?: boolean }>) => {
    return new Promise<string | null>((resolve) => {
      const menu = new Menu()
      for (const item of items) {
        if (item.label === '---') {
          menu.append(new MenuItem({ type: 'separator' }))
        } else {
          menu.append(new MenuItem({
            label: item.label,
            enabled: item.enabled !== false,
            click: () => resolve(item.action),
          }))
        }
      }
      menu.popup({ window: mainWindow ?? undefined, callback: () => resolve(null) })
    })
  })

  // File-system watcher: watch a directory and emit 'cct:fs-changed' events
  ipcMain.handle('cct:watch-path', async (_e, watchPath: string) => {
    startWatcher(watchPath)
    return true
  })

  ipcMain.handle('cct:unwatch', async () => {
    stopWatcher()
    return true
  })
}

// ── Native app menu ───────────────────────────────────────────────────────────

function buildAppMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    {
      label: '文件',
      submenu: [
        {
          label: '切换项目文件夹…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: async () => {
            if (!mainWindow) return
            const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
            if (!result.canceled && result.filePaths[0]) {
              mainWindow.webContents.send('cct:switch-project', result.filePaths[0])
            }
          },
        },
        { type: 'separator' as const },
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '刷新数据',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.send('cct:menu-refresh'),
        },
        {
          label: '切换侧栏',
          accelerator: 'CmdOrCtrl+B',
          click: () => mainWindow?.webContents.send('cct:menu-toggle-sidebar'),
        },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
        ...(isDev ? [
          { type: 'separator' as const },
          { role: 'toggleDevTools' as const },
          { role: 'reload' as const },
        ] : []),
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
        ] : []),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '帮助与快捷键',
          accelerator: 'CmdOrCtrl+Shift+/',
          click: () => mainWindow?.webContents.send('cct:menu-navigate', '/help'),
        },
        {
          label: '同步中心',
          click: () => mainWindow?.webContents.send('cct:menu-navigate', '/sync'),
        },
        {
          label: '偏好设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => mainWindow?.webContents.send('cct:menu-navigate', '/settings'),
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

// ── File system watcher ───────────────────────────────────────────────────────

function stopWatcher() {
  if (watcherCleanup) {
    watcherCleanup()
    watcherCleanup = null
  }
}

function startWatcher(watchPath: string) {
  stopWatcher()
  if (!fs.existsSync(watchPath)) return

  const onChange = (eventType: string, filename: string | Buffer | null) => {
    if (!mainWindow) return
    mainWindow.webContents.send('cct:fs-changed', {
      path: watchPath,
      file: filename ? filename.toString() : null,
      event: eventType,
    })
  }

  // Use recursive option on platforms that support it
  const supportsRecursive = process.platform === 'darwin' || process.platform === 'win32'
  const watcher = fs.watch(watchPath, { recursive: supportsRecursive }, onChange)
  watcher.on('error', () => stopWatcher())
  watcherCleanup = () => watcher.close()
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
  Menu.setApplicationMenu(buildAppMenu())
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
