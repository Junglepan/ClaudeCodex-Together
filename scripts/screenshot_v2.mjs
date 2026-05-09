import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'

const URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'
const OUT_DIR = path.resolve('screenshots/v2')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  // Basic pages
  for (const [name, urlPath] of [
    ['01-overview',      '/overview'],
    ['02-config-claude', '/config/claude'],
    ['03-config-codex',  '/config/codex'],
    ['04-sync',          '/sync'],
    ['05-help',          '/help'],
  ]) {
    const page = await ctx.newPage()
    page.on('console', (m) => m.type() === 'error' && console.log('[ERR]', m.text()))
    await page.goto(`${URL}${urlPath}`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
    console.log(`✓ ${name}`)
    await page.close()
  }

  // Claude config: click 配置明细 tab
  const p2 = await ctx.newPage()
  await p2.goto(`${URL}/config/claude`, { waitUntil: 'networkidle' })
  await p2.waitForTimeout(800)
  await p2.locator('button:has-text("配置明细")').first().click()
  await p2.waitForTimeout(800)
  await p2.screenshot({ path: path.join(OUT_DIR, '06-claude-files-tab.png') })
  console.log('✓ 06-claude-files-tab')

  // Click CLAUDE.md file to open detail + CRUD buttons
  const fileBtn = p2.locator('button').filter({ hasText: 'CLAUDE.md' }).first()
  if (await fileBtn.count() > 0) {
    await fileBtn.click()
    await p2.waitForTimeout(1000)
    await p2.screenshot({ path: path.join(OUT_DIR, '07-file-detail-crud.png') })
    console.log('✓ 07-file-detail-crud')
  }
  await p2.close()

  await browser.close()
  console.log(`\nAll screenshots in screenshots/v2/`)
}

main().catch((e) => { console.error(e); process.exit(1) })
