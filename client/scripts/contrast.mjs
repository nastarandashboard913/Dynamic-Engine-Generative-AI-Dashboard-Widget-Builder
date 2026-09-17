import { chromium } from 'playwright'

const AUDIT = () => {
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number)
  const ratio = (fg, bg) => {
    const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a)
    return (l1 + 0.05) / (l2 + 0.05)
  }
  // Flatten a translucent foreground onto its backdrop before comparing.
  const over = (fg, bg) => {
    const a = fg[3] ?? 1
    return a >= 1 ? fg.slice(0, 3) : fg.slice(0, 3).map((c, i) => c * a + bg[i] * (1 - a))
  }
  // Returns null when the nearest painted background is a gradient or image:
  // a single colour cannot represent it, and guessing produces false failures
  // (the logo reported 1.01:1 purely because its gradient was invisible here).
  const bgOf = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const c = parse(cs.backgroundColor)
      if (c.length >= 3 && (c[3] ?? 1) > 0.95) return c.slice(0, 3)
      n = n.parentElement
    }
    return parse(getComputedStyle(document.body).backgroundColor).slice(0, 3)
  }

  const out = new Map()
  for (const el of document.querySelectorAll('*')) {
    const txt = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join('')
    if (!txt) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue

    const bg = bgOf(el)
    if (!bg) continue
    const fg = over(parse(cs.color), bg)
    const size = parseFloat(cs.fontSize)
    const bold = +cs.fontWeight >= 700
    // WCAG "large text": >=24px, or >=18.66px bold.
    const large = size >= 24 || (bold && size >= 18.66)
    const need = large ? 3 : 4.5
    const cr = ratio(fg, bg)

    const key = `${cs.color}|${bg.join(',')}|${Math.round(size)}`
    if (!out.has(key)) {
      out.set(key, { cr: +cr.toFixed(2), need, size: Math.round(size), bold, large, pass: cr >= need, sample: txt.slice(0, 32), count: 0 })
    }
    out.get(key).count++
  }
  return [...out.values()].sort((a, b) => a.cr - b.cr)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173', { waitUntil: 'load' })
await page.waitForTimeout(4500)

let totalFail = 0
for (const theme of ['dark', 'light', 'hc']) {
  await page.evaluate((t) => { document.documentElement.dataset.theme = t }, theme)
  // Colour transitions must settle first. At 400ms the sampler was reading
  // values midway between the two palettes — greys that belong to neither — and
  // reporting them as contrast failures.
  await page.waitForTimeout(1500)
  const rows = await page.evaluate(AUDIT)
  const fails = rows.filter((r) => !r.pass)
  totalFail += fails.length

  console.log(`\n${'═'.repeat(74)}\n  THEME: ${theme.toUpperCase()}   ${rows.length} text styles   ${fails.length ? `❌ ${fails.length} fail` : '✅ all pass'}\n${'═'.repeat(74)}`)
  if (fails.length) {
    console.log(`  ${'ratio'.padStart(6)} ${'need'.padStart(5)} ${'size'.padStart(5)}  ${'uses'.padStart(4)}  sample`)
    for (const f of fails) {
      console.log(`  ${String(f.cr).padStart(6)} ${String(f.need).padStart(5)} ${String(f.size + 'px').padStart(5)}  ${String(f.count).padStart(4)}  "${f.sample}"`)
    }
  }
  const worstPass = rows.filter((r) => r.pass)[0]
  if (worstPass) console.log(`  closest passing: ${worstPass.cr}:1 (needs ${worstPass.need}) — "${worstPass.sample}"`)
}

await browser.close()
console.log(`\n${'═'.repeat(74)}\n  ${totalFail === 0 ? '✅ no contrast failures' : `❌ ${totalFail} failing text styles across all themes`}`)
process.exit(totalFail ? 1 : 0)
