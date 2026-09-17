import { chromium } from 'playwright'
const URL = 'http://localhost:5173'
const results = []
const check = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`  ${pass ? '✅' : '❌'} ${name}${detail ? `  — ${detail}` : ''}`) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(URL, { waitUntil: 'load' })
await page.waitForTimeout(4500)

console.log('\n── RENDERING ──')
const widgets = await page.$$eval('[data-widget-type]', (els) => els.map((e) => e.dataset.widgetType))
check('all 9 widgets rendered', widgets.length === 9, `${widgets.length}: ${[...new Set(widgets)].join(', ')}`)
check('no error fallbacks visible', (await page.$$('[role="alert"]')).length === 0)

console.log('\n── VIRTUALISATION ──')
const rows = () => page.$$eval('[data-widget-type="DATA_TABLE"] [style*="translateY"]', (e) => e.length)
const n0 = await rows()
check('table virtualises', n0 > 0 && n0 < 60, `${n0} rows in DOM (of 5,000)`)
// Compare the FIRST ROW's text, not the widget's — the widget's leading text is
// the title and filter placeholder, which do not change when rows scroll.
const firstRow = () => page.$eval('[data-widget-type="DATA_TABLE"] [style*="translateY"]', (el) => el.textContent.trim().slice(0, 30))
const firstBefore = await firstRow()
await page.$eval('[data-widget-type="DATA_TABLE"] .overflow-y-auto', (el) => { el.scrollTop = 4000 })
await page.waitForTimeout(400)
const n1 = await rows()
const firstAfter = await firstRow()
check('table scrolls internally', firstBefore !== firstAfter, `"${firstBefore}" → "${firstAfter}"`)
check('row count stays bounded while scrolling', n1 > 0 && n1 < 60, `${n1} rows`)

console.log('\n── INTERACTION ──')
await page.$eval('[data-widget-type="DATA_TABLE"] .overflow-y-auto', (el) => { el.scrollTop = 0 })
const filter = page.locator('[data-widget-type="DATA_TABLE"] input')
await filter.fill('Delta')
await page.waitForTimeout(500)
const filtered = await page.$eval('[data-widget-type="DATA_TABLE"]', (el) => el.textContent)
check('filter works', filtered.includes('Delta') && !filtered.includes('Orion Retail'))
await filter.fill('')
await page.waitForTimeout(400)

const scoreHeader = page.locator('[data-widget-type="DATA_TABLE"] button', { hasText: /^Score$/ })
await scoreHeader.click(); await page.waitForTimeout(400)
check('sort works', await scoreHeader.locator('svg').count() > 0, 'sort indicator appears')

const box = page.locator('[data-widget-type="CHECKLIST"] [role="checkbox"]').first()
const before = await box.getAttribute('aria-checked')
await box.click(); await page.waitForTimeout(150)
check('checklist toggles optimistically', (await box.getAttribute('aria-checked')) !== before, `${before} → ${await box.getAttribute('aria-checked')}`)

console.log('\n── THEME ──')
for (const t of ['light', 'hc', 'dark']) {
  await page.locator('button[aria-label^="Theme:"]').click()
  await page.getByRole('menuitem').filter({ hasText: new RegExp(t === 'hc' ? 'High contrast' : t, 'i') }).click()
  await page.waitForTimeout(250)
  check(`theme → ${t}`, (await page.evaluate(() => document.documentElement.dataset.theme)) === t)
}

console.log('\n── INSPECTOR / MODAL ──')
await page.locator('[data-widget-type="METRIC_CARD"] button[aria-label^="Options"]').first().click({ force: true })
await page.getByRole('menuitem', { name: /Inspect schema/ }).click()
await page.waitForTimeout(400)
check('metric card has an inspector', await page.getByRole('dialog').isVisible())
await page.keyboard.press('Escape'); await page.waitForTimeout(300)
check('Escape closes modal', (await page.getByRole('dialog').count()) === 0)

console.log('\n── RESPONSIVE (375px) ──')
await page.setViewportSize({ width: 375, height: 812 })
await page.waitForTimeout(400)
check('sidebar hidden below lg', !(await page.locator('aside[aria-label="Primary navigation"]').isVisible()))
await page.locator('button[aria-label="Open navigation"]').click()
await page.waitForTimeout(400)
check('drawer opens', await page.locator('aside[aria-label="Primary navigation"]').isVisible())
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
check('Escape closes drawer', !(await page.locator('aside[aria-label="Primary navigation"]').isVisible()))
const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
check('no horizontal scroll leak', noHScroll)

console.log('\n── FAULT INJECTION ──')
await page.setViewportSize({ width: 1440, height: 900 })
await page.locator('button[aria-label="More options"]').click()
await page.getByRole('menuitemcheckbox', { name: /Inject faults/ }).click()
await page.keyboard.press('Escape')
await page.locator('textarea').fill('show me high risk accounts')
await page.keyboard.press('Enter')
await page.waitForTimeout(5000)
const alerts = await page.$$('[role="alert"]')
check('broken widgets render fallbacks', alerts.length === 2, `${alerts.length} fallback(s)`)
const stillWorks = await page.$$eval('[data-widget-type]', (e) => e.length)
check('rest of dashboard unaffected', stillWorks >= 9, `${stillWorks} widgets still mounted`)

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${'═'.repeat(60)}\n  ${results.length - failed.length}/${results.length} passed`)
if (failed.length) { console.log('  FAILED:'); failed.forEach((f) => console.log(`    ❌ ${f.name}`)) }
process.exit(failed.length ? 1 : 0)
