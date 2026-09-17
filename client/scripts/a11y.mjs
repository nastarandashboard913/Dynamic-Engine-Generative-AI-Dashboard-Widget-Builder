import { chromium } from 'playwright'
const results = []
const check = (n, pass, d = '') => { results.push(pass); console.log(`  ${pass ? '✅' : '❌'} ${n}${d ? `  — ${d}` : ''}`) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173', { waitUntil: 'load' })
await page.waitForTimeout(4500)

console.log('\n── FIX 2: skip link ──')
await page.keyboard.press('Tab')
const first = await page.evaluate(() => {
  const a = document.activeElement
  return { text: a?.textContent?.trim(), visible: a ? getComputedStyle(a).position === 'fixed' : false }
})
check('first Tab lands on skip link', first.text === 'Skip to main content', `focused: "${first.text}"`)
check('skip link becomes visible on focus', first.visible)
await page.keyboard.press('Enter')
await page.waitForTimeout(300)
check('skip link moves focus to main', await page.evaluate(() => document.activeElement?.id === 'main'))

console.log('\n── FIX 3: focus restoration ──')
await page.setViewportSize({ width: 375, height: 812 })
await page.waitForTimeout(400)
const hamburger = page.locator('button[aria-label="Open navigation"]')
await hamburger.focus()
await page.keyboard.press('Enter')
await page.waitForTimeout(450)
check('drawer opened', await page.locator('aside[aria-label="Primary navigation"]').isVisible())
await page.keyboard.press('Escape')
await page.waitForTimeout(450)
const restored = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
check('focus returns to the trigger', restored === 'Open navigation', `focus on: "${restored}"`)

console.log('\n── FIX 1: stream announcement ──')
await page.setViewportSize({ width: 1440, height: 900 })
const live = await page.evaluate(() => {
  const el = document.querySelector('[aria-live="polite"].sr-only')
  return el ? { text: el.textContent.trim(), hidden: el.getBoundingClientRect().width <= 1 } : null
})
check('live region exists', !!live)
check('announces completion', /Dashboard ready with \d+ widgets/.test(live?.text ?? ''), `"${live?.text}"`)
check('live region is visually hidden', live?.hidden === true)

console.log('\n── FIX 4: drag instructions ──')
const instr = await page.evaluate(() => document.body.innerText.includes('') ? [...document.querySelectorAll('[id^="DndDescribedBy"]')].map(e => e.textContent).join(' ') : '')
check('dnd instructions in DOM', instr.includes('arrow keys'), `"${instr.slice(0, 60)}…"`)
const handle = page.locator('button[aria-label="Reorder widget"]').first()
await handle.focus()
const described = await handle.evaluate((el) => el.getAttribute('aria-describedby'))
check('drag handle references instructions', !!described, `aria-describedby="${described}"`)

await browser.close()
const failed = results.filter((r) => !r).length
console.log(`\n${'═'.repeat(50)}\n  ${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
