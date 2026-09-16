/* ============================================================================
 * In-memory mock datastore
 * ---------------------------------------------------------------------------
 * Stands in for the "customers_db · 4 tables" the reference UI cites. Data is
 * generated once at boot from a seeded PRNG so every restart produces the same
 * numbers — a dashboard whose KPIs shuffle on refresh is impossible to review.
 * ========================================================================= */

export interface Account {
  account: string
  exposure: number
  score: number
  region: string
  segment: string
  flagged: boolean
}

export interface Investigation {
  id: string
  prompt: string
  createdAt: number
}

/** Mulberry32 — small, fast, deterministic. */
function seeded(seed: number): () => number {
  return function next() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const REGIONS = ['South-East', 'West', 'Midwest', 'North', 'Central'] as const
const SEGMENTS = ['Enterprise', 'Mid-Market', 'SMB', 'Government'] as const
const PREFIX = [
  'ABC', 'Delta', 'Orion', 'Vega', 'Nimbus', 'Helix', 'Quantum', 'Apex', 'Zenith',
  'Cobalt', 'Summit', 'Pioneer', 'Atlas', 'Meridian', 'Lumen', 'Vertex', 'Aurora',
  'Cascade', 'Ironwood', 'Beacon', 'Halcyon', 'Solstice', 'Keystone', 'Northwind',
]
const SUFFIX = [
  'Manufacturing', 'Logistics', 'Retail', 'Foods', 'Tech', 'Industries', 'Holdings',
  'Group', 'Partners', 'Systems', 'Labs', 'Capital', 'Energy', 'Materials',
]

/** ~5,000 rows: enough that an unvirtualised table is visibly janky. */
const ROW_COUNT = 5000

function generateAccounts(): Account[] {
  const rand = seeded(20260914)
  const out: Account[] = []
  const seen = new Set<string>()

  // The five accounts from the reference screenshot are pinned to the top so
  // the demo matches the design exactly.
  const pinned: Array<[string, number, number, string]> = [
    ['ABC Manufacturing', 5.1, 0.93, 'South-East'],
    ['Delta Logistics', 4.7, 0.89, 'West'],
    ['Orion Retail', 3.9, 0.81, 'Midwest'],
    ['Vega Foods', 3.4, 0.77, 'South-East'],
    ['Nimbus Tech', 2.9, 0.72, 'North'],
  ]
  for (const [account, exposure, score, region] of pinned) {
    out.push({
      account,
      exposure,
      score,
      region,
      segment: SEGMENTS[Math.floor(rand() * SEGMENTS.length)]!,
      flagged: score > 0.85,
    })
    seen.add(account)
  }

  while (out.length < ROW_COUNT) {
    const name = `${PREFIX[Math.floor(rand() * PREFIX.length)]} ${SUFFIX[Math.floor(rand() * SUFFIX.length)]}`
    const id = `${name} ${out.length}`
    if (seen.has(id)) continue
    seen.add(id)
    // Skew scores low so "high risk" stays a meaningful minority.
    const score = Math.min(0.99, Math.round(rand() ** 1.6 * 100) / 100)
    out.push({
      account: name,
      exposure: Math.round(rand() * 48) / 10 + 0.1,
      score,
      region: REGIONS[Math.floor(rand() * REGIONS.length)]!,
      segment: SEGMENTS[Math.floor(rand() * SEGMENTS.length)]!,
      flagged: score > 0.85,
    })
  }

  return out.sort((a, b) => b.score - a.score)
}

export const accounts: Account[] = generateAccounts()

/** Derived aggregates the KPI widgets read from. */
export const stats = {
  get highRisk() {
    return accounts.filter((a) => a.score >= 0.6).length
  },
  get critical() {
    return accounts.filter((a) => a.score >= 0.85).length
  },
  get avgScore() {
    const hi = accounts.filter((a) => a.score >= 0.6)
    return hi.reduce((sum, a) => sum + a.score, 0) / hi.length
  },
  get flaggedToday() {
    return accounts.filter((a) => a.flagged).length % 97
  },
}

/** Histogram of risk scores in 0.05-wide bins. */
export function riskDistribution(): Array<{ label: string; count: number }> {
  const bins = new Array(20).fill(0) as number[]
  for (const a of accounts) {
    const i = Math.min(19, Math.floor(a.score * 20))
    bins[i] = (bins[i] ?? 0) + 1
  }
  return bins.map((count, i) => ({
    label: (i * 0.05).toFixed(2),
    count,
  }))
}

/* --- Mutable state the action endpoint writes to -------------------------- */

/** Per-widget state that survives across requests, keyed by widget id. */
export const widgetState = new Map<string, Record<string, unknown>>()

export const investigations: Investigation[] = [
  { id: 'inv_03', prompt: 'Which accounts are high-risk and need review?', createdAt: Date.now() },
  { id: 'inv_02', prompt: 'How many accounts are we worried about right now?', createdAt: Date.now() - 11 * 60_000 },
  { id: 'inv_01', prompt: 'I want to review our risk exposure.', createdAt: Date.now() - 23 * 60_000 },
]
