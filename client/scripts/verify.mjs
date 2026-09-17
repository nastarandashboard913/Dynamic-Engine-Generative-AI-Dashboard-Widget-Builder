import { chromium } from 'playwright'
const R = []
const ck = (n, pass, d = '') => { R.push({ n, pass }); console.log(`  ${pass ? '✅' : '❌'} ${n}${d ? `  — ${d}` : ''}`) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

// Collect anything the app logs or fails to load.
const errors = [], failed = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)) })
page.on('pageerror', (e) => errors.push('UNCAUGHT: ' + e.message.slice(0, 120)))
page.on('requestfailed', (r) => failed.push(`${r.url().split('/').pop()} ${r.failure()?.errorText}`))

await page.goto('http://localhost:5173', { waitUntil: 'load' })
await page.waitForTimeout(5000)

console.log('\n── CONSOLE / NETWORK ──')
ck('no console errors', errors.length === 0, errors.length ? errors.slice(0, 3).join(' | ') : 'clean')
ck('no failed requests', failed.length === 0, failed.length ? failed.slice(0, 3).join(' | ') : 'clean')

console.log('\n── THEMES render cleanly ──')
for (const t of ['dark', 'light', 'hc']) {
  const before = errors.length
  await page.locator('button[aria-label^="Theme:"]').click()
  await page.getByRole('menuitem').filter({ hasText: new RegExp(t === 'hc' ? 'High contrast' : t, 'i') }).click()
  await page.waitForTimeout(600)
  const applied = await page.evaluate(() => document.documentElement.dataset.theme)
  const painted = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  ck(`${t}: applies + repaints, no errors`, applied === t && errors.length === before, `bg ${painted}`)
}

console.log('\n── LAYOUT field drives the grid ──')
for (const [prompt, expect] of [['high risk accounts', 4], ['risk distribution spread', 2]]) {
  await page.locator('textarea').fill(prompt)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(4000)
  const spans = await page.$$eval('[data-widget-type="METRIC_CARD"]', (els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().width)))
  const perRow = spans.length ? Math.round(778 / spans[0]) : 0
  ck(`"${prompt.slice(0, 24)}" → ~${expect} columns`, perRow === expect, `${spans.length} KPIs at ${spans[0]}px → ${perRow}-up`)
}

console.log('\n── RESPONSIVE sweep ──')
for (const w of [375, 768, 1024, 1280, 1920]) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.waitForTimeout(500)
  const noLeak = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  const sidebar = await page.locator('aside[aria-label="Primary navigation"]').isVisible()
  const history = await page.locator('aside[aria-label="Investigation history"]').isVisible()
  ck(`${w}px — no h-scroll`, noLeak, `sidebar ${sidebar ? 'docked' : 'drawer'}, history ${history ? 'docked' : 'drawer'}`)
}

await browser.close()
const bad = R.filter((r) => !r.pass)
console.log(`\n${'═'.repeat(62)}\n  ${R.length - bad.length}/${R.length} passed`)
if (bad.length) bad.forEach((b) => console.log(`    ❌ ${b.n}`))
process.exit(bad.length ? 1 : 0)
