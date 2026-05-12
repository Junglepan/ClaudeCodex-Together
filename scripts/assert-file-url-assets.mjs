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

if (!electronMainSource.includes('app.asar.unpacked') || !electronMainSource.includes('resolvePythonCommand')) {
  console.error('electron/main.ts must resolve unpacked backend files and an absolute Python command for packaged app startup.')
  process.exit(1)
}

const asarUnpack = packageJson.build?.asarUnpack
const backendUnpacked = Array.isArray(asarUnpack) && asarUnpack.includes('backend/**/*')

if (!backendUnpacked) {
  console.error('package.json build.asarUnpack must include backend/**/* so Python can execute backend files outside app.asar.')
  process.exit(1)
}

console.log('Packaged Electron renderer and backend paths are compatible with file:// loading.')
