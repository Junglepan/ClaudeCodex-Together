import fs from 'node:fs'
import path from 'node:path'

const indexPath = path.resolve('dist/index.html')
const html = fs.readFileSync(indexPath, 'utf8')
const appPath = path.resolve('src/App.tsx')
const appSource = fs.readFileSync(appPath, 'utf8')
const electronMainPath = path.resolve('electron/main.ts')
const electronMainSource = fs.readFileSync(electronMainPath, 'utf8')
const packageJsonPath = path.resolve('package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

const rootAbsoluteAssetPattern = /\b(?:src|href)="\/(?:assets|icon\.(?:svg|png))\b/g
const matches = html.match(rootAbsoluteAssetPattern) ?? []

if (matches.length > 0) {
  console.error(
    [
      'dist/index.html contains root-absolute asset URLs.',
      'These fail when Electron loads the renderer through file://.',
      `Found: ${matches.join(', ')}`,
    ].join('\n'),
  )
  process.exit(1)
}

if (!appSource.includes('createHashRouter')) {
  console.error('src/App.tsx must use createHashRouter so packaged file:// loads route / from the URL hash.')
  process.exit(1)
}

if (!electronMainSource.includes("ipcMain.handle('cct:api'") || electronMainSource.includes('uvicorn') || electronMainSource.includes('resolvePythonCommand')) {
  console.error('electron/main.ts must use direct IPC backend handlers and must not spawn Python/FastAPI.')
  process.exit(1)
}

const packagedFiles = packageJson.build?.files ?? []
if (JSON.stringify(packagedFiles).includes('backend') || packageJson.build?.asarUnpack) {
  console.error('package.json must not package the deleted Python backend or backend asarUnpack entries.')
  process.exit(1)
}

console.log('Packaged Electron renderer and IPC backend paths are compatible with file:// loading.')
