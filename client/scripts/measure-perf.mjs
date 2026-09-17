import { chromium } from 'playwright'

const URL = 'http://localhost:5173'

const INIT = () => {
  window.__perf = { lcp: 0, lcpEl: '', cls: 0, shifts: [], longTasks: [], events: [] }
  const safe = (type, cb, extra = {}) => {
    try {
      new PerformanceObserver((l) => cb(l.getEntries())).observe({ type, buffered: true, ...extra })
    } catch {}
  }
  const describe = (n) => {
    if (!n || n.nodeType !== 1) return '?'
    const cell = n.closest?.('[data-widget-type]')
    if (cell) return `widget:${cell.dataset.widgetType}`
    const c = typeof n.className === 'string' ? n.className.split(/\s+/).slice(0, 2).join('.') : ''
    return n.tagName.toLowerCase() + (c ? '.' + c : '')
  }
  safe('largest-contentful-paint', (es) => {
    for (const e of es) { window.__perf.lcp = e.startTime; window.__perf.lcpEl = describe(e.element) }
  })
  safe('layout-shift', (es) => {
    for (const e of es) {
      if (e.hadRecentInput) continue
      window.__perf.cls += e.value
      window.__perf.shifts.push({ v: +e.value.toFixed(4), at: Math.round(e.startTime), src: describe(e.sources?.[0]?.node) })
    }
  })
  safe('longtask', (es) => { for (const e of es) window.__perf.longTasks.push(Math.round(e.duration)) })
  safe('event', (es) => { for (const e of es) window.__perf.events.push({ name: e.name, dur: Math.round(e.duration) }) }, { durationThreshold: 16 })
}

async function run(label, viewport) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport })
  await page.addInitScript(INIT)

  await page.goto(URL, { waitUntil: 'load' })
  // Let the whole stream land and settle.
  await page.waitForTimeout(4500)

  const perf = await page.evaluate(() => window.__perf)
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0]
    return { ttfb: Math.round(n.responseStart), domReady: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }
  })
  const res = await page.evaluate(() =>
    performance.getEntriesByType('resource')
      .map((r) => ({ name: r.name.split('/').pop().slice(0, 34), start: Math.round(r.startTime), dur: Math.round(r.duration), kb: Math.round((r.transferSize || 0) / 1024) }))
      .sort((a, b) => b.dur - a.dur).slice(0, 7))

  console.log(`\n${'═'.repeat(72)}\n  ${label}  (${viewport.width}×${viewport.height})\n${'═'.repeat(72)}`)
  const verdict = (v, good, poor) => (v <= good ? '✅ good' : v <= poor ? '⚠️  needs work' : '❌ poor')
  console.log(`  LCP              ${(perf.lcp / 1000).toFixed(2)}s   ${verdict(perf.lcp, 2500, 4000)}   → ${perf.lcpEl}`)
  console.log(`  CLS              ${perf.cls.toFixed(4)}   ${verdict(perf.cls, 0.1, 0.25)}`)
  console.log(`  TTFB             ${nav.ttfb}ms`)
  console.log(`  DOM ready        ${nav.domReady}ms`)
  console.log(`  load event       ${nav.load}ms`)
  console.log(`  long tasks       ${perf.longTasks.length}${perf.longTasks.length ? `  (max ${Math.max(...perf.longTasks)}ms, total ${perf.longTasks.reduce((a, b) => a + b, 0)}ms)` : ''}`)

  if (perf.shifts.length) {
    console.log('\n  layout shifts:')
    for (const s of perf.shifts.slice(0, 6)) console.log(`     +${String(s.at).padStart(5)}ms  ${s.v.toFixed(4)}  ${s.src}`)
  }

  console.log('\n  slowest resources:')
  for (const r of res) console.log(`     +${String(r.start).padStart(5)}ms  ${String(r.dur).padStart(5)}ms  ${String(r.kb).padStart(4)}kB  ${r.name}`)

  // --- theme switch interaction ---
  await page.evaluate(() => { window.__perf.events = [] })
  const themeBtn = page.locator('button[aria-label^="Theme:"]')
  const t0 = Date.now()
  await themeBtn.click()
  await page.getByRole('menuitem', { name: /Light/ }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', { timeout: 5000 })
  const applied = Date.now() - t0
  await page.waitForTimeout(600)
  const evts = await page.evaluate(() => window.__perf.events)
  const worst = evts.length ? Math.max(...evts.map((e) => e.dur)) : 0

  console.log('\n  theme switch (dark → light):')
  console.log(`     attribute applied in  ${applied}ms  (includes Playwright click overhead)`)
  console.log(`     slowest input event   ${worst}ms  ${verdict(worst, 100, 200)}`)
  if (evts.length) console.log(`     events: ${evts.map((e) => `${e.name} ${e.dur}ms`).join(', ')}`)

  await browser.close()
  return { label, lcp: perf.lcp, cls: perf.cls, worst }
}

await run('DESKTOP', { width: 1440, height: 900 })
await run('MOBILE', { width: 375, height: 812 })
