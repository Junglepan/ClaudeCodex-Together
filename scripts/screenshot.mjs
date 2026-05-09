import { chromium } from 'playwright'
import { mkdir } from 'fs/promises'
import path from 'path'

const URL = process.env.PREVIEW_URL || 'http://127.0.0.1:4173'
const OUT_DIR = path.resolve('screenshots')

const PAGES = [
  { name: '01-overview',      path: '/overview',      label: '概览' },
  { name: '02-config-files',  path: '/config-files',  label: '配置文件（默认）' },
  { name: '03-active-config', path: '/active-config', label: '当前生效' },
  { name: '04-path-mapping',  path: '/path-mapping',  label: '路径映射' },
  { name: '05-sync-empty',    path: '/sync',          label: '同步中心（初始）' },
  { name: '06-help',          path: '/help',          label: '说明' },
]

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  })

  for (const p of PAGES) {
    const page = await ctx.newPage()
    page.on('console', (msg) => msg.type() === 'error' && console.log('[console]', msg.text()))
    await page.goto(`${URL}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForTimeout(800)  // let mock api timeouts settle
    const file = path.join(OUT_DIR, `${p.name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log(`✓ ${p.label.padEnd(20)} → ${file}`)
    await page.close()
  }

  // Detail page: click first file in config-files page
  const page = await ctx.newPage()
  await page.goto(`${URL}/config-files`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const firstFile = page.locator('button:has-text("settings.json")').first()
  if (await firstFile.count() > 0) {
    await firstFile.click()
    await page.waitForTimeout(800)
    const file = path.join(OUT_DIR, '07-file-detail.png')
    await page.screenshot({ path: file, fullPage: false })
    console.log(`✓ 文件详情             → ${file}`)
  }
  await page.close()

  // Sync after dry-run
  const syncPage = await ctx.newPage()
  await syncPage.goto(`${URL}/sync`, { waitUntil: 'networkidle' })
  await syncPage.waitForTimeout(500)
  const dryRunBtn = syncPage.locator('button:has-text("Dry Run")')
  if (await dryRunBtn.count() > 0) {
    await dryRunBtn.click()
    await syncPage.waitForTimeout(1500)
    const file = path.join(OUT_DIR, '08-sync-report.png')
    await syncPage.screenshot({ path: file, fullPage: false })
    console.log(`✓ 同步报告             → ${file}`)
  }
  await syncPage.close()

  await browser.close()
  console.log('\n所有截图已生成在 screenshots/')
}

main().catch((e) => { console.error(e); process.exit(1) })
