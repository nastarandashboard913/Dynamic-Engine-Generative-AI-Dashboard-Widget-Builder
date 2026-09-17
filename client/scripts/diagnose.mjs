import { chromium } from 'playwright'
const URL = 'http://localhost:5173'

async function diagnose(label, viewport) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForTimeout(4500)

  console.log(`\n${'═'.repeat(70)}\n  ${label}  (${viewport.width}×${viewport.height})\n${'═'.repeat(70)}`)

  // --- 1. Declared reservation vs actual rendered height -------------------
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('[data-widget-type]')].map((el) => {
      const reserved = parseInt(getComputedStyle(el).getPropertyValue('--reserved-h')) || 0
      const effective = parseFloat(getComputedStyle(el).minHeight) || 0
      return { type: el.dataset.widgetType, reserved, effective, actual: Math.round(el.getBoundingClientRect().height) }
    }))

  console.log('\n  RESERVED vs ACTUAL height')
  console.log(`     ${'widget'.padEnd(20)} ${'declared'.padStart(9)} ${'effective'.padStart(10)} ${'actual'.padStart(7)}   overflow`)
  for (const c of cells) {
    const over = c.actual - c.effective
    const flag = over > 1 ? `❌ +${Math.round(over)}px` : '✅'
    console.log(`     ${c.type.padEnd(20)} ${String(c.reserved).padStart(9)} ${String(Math.round(c.effective)).padStart(10)} ${String(c.actual).padStart(7)}   ${flag}`)
  }

  // --- 2. Theme switch cost, measured to next paint ------------------------
  const themeCost = async (disableBlur) => {
    if (disableBlur) {
      await page.addStyleTag({ content: `*, *::before, *::after { filter: none !important; backdrop-filter: none !important; }` })
    }
    return page.evaluate(async () => {
      const paint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      const runs = []
      for (const t of ['light', 'dark', 'light', 'dark']) {
        await paint()
        const t0 = performance.now()
        document.documentElement.dataset.theme = t
        await paint()
        runs.push(performance.now() - t0)
      }
      runs.sort((a, b) => a - b)
      return { median: runs[2], min: runs[0], max: runs[3] }
    })
  }

  const withBlur = await themeCost(false)
  const withoutBlur = await themeCost(true)

  console.log('\n  THEME SWITCH → next paint')
  console.log(`     blur enabled   median ${withBlur.median.toFixed(0)}ms   (min ${withBlur.min.toFixed(0)} / max ${withBlur.max.toFixed(0)})`)
  console.log(`     blur disabled  median ${withoutBlur.median.toFixed(0)}ms   (min ${withoutBlur.min.toFixed(0)} / max ${withoutBlur.max.toFixed(0)})`)
  const delta = withBlur.median - withoutBlur.median
  console.log(`     → blur accounts for ${delta.toFixed(0)}ms (${((delta / withBlur.median) * 100).toFixed(0)}% of the cost)`)

  // --- 3. How much DOM is being restyled -----------------------------------
  const counts = await page.evaluate(() => ({
    total: document.querySelectorAll('*').length,
    transitions: [...document.querySelectorAll('*')].filter((e) => getComputedStyle(e).transitionProperty !== 'none').length,
    blurred: [...document.querySelectorAll('*')].filter((e) => {
      const s = getComputedStyle(e)
      return s.filter.includes('blur') || s.backdropFilter.includes('blur')
    }).length,
  }))
  console.log('\n  DOM restyled on theme change')
  console.log(`     elements            ${counts.total}`)
  console.log(`     with transitions    ${counts.transitions}`)
  console.log(`     with blur filters   ${counts.blurred}`)

  await browser.close()
}

await diagnose('DESKTOP', { width: 1440, height: 900 })
await diagnose('MOBILE', { width: 375, height: 812 })
