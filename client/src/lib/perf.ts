/* ============================================================================
 * Performance instrumentation
 * ---------------------------------------------------------------------------
 * The README claims zero CLS and the brief asks for sub-100ms response. Both
 * were arguments about architecture rather than measurements, which is a weak
 * position: an argument cannot tell you that a headline wrapped to four lines
 * on a phone and pushed the grid down by 40px.
 *
 * This collects four signals from the platform's own APIs — no library, no
 * sampling, no dependency:
 *
 *   layout-shift  → CLS, plus which element moved
 *   longtask      → main-thread blocks that cost frames
 *   event         → interaction latency (input → next paint)
 *   custom marks  → cost of validating a payload before it renders
 *
 * Observers are passive and buffered, so this measures the real session rather
 * than a synthetic one, and it never changes what it observes.
 * ========================================================================= */

/** A single layout shift, with the element responsible where available. */
export interface ShiftRecord {
  value: number
  at: number
  /** Best-effort description of the node that moved. */
  source: string
}

export interface InteractionRecord {
  name: string
  duration: number
  target: string
}

export interface ParseRecord {
  label: string
  duration: number
  /** Rows/items processed, when the caller knows. */
  size?: number
}

export interface PerfSnapshot {
  /** Sum of layout shifts not attributable to recent input — the CLS score. */
  cls: number
  shifts: ShiftRecord[]
  longTasks: number
  longestTask: number
  interactions: InteractionRecord[]
  slowestInteraction: number
  parses: ParseRecord[]
  supported: boolean
  version: number
}

const MAX_RECORDS = 25

let state: PerfSnapshot = {
  cls: 0,
  shifts: [],
  longTasks: 0,
  longestTask: 0,
  interactions: [],
  slowestInteraction: 0,
  parses: [],
  supported: typeof PerformanceObserver !== 'undefined',
  version: 0,
}

const listeners = new Set<() => void>()

/**
 * Replaces the snapshot rather than mutating it. `useSyncExternalStore`
 * compares snapshots by reference, so mutating in place would leave React
 * unaware anything changed.
 */
function commit(patch: Partial<PerfSnapshot>) {
  state = { ...state, ...patch, version: state.version + 1 }
  for (const fn of listeners) fn()
}

export function subscribePerf(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getPerfSnapshot(): PerfSnapshot {
  return state
}

export function resetPerf() {
  commit({
    cls: 0,
    shifts: [],
    longTasks: 0,
    longestTask: 0,
    interactions: [],
    slowestInteraction: 0,
    parses: [],
  })
}

/* --- Entry shapes the DOM lib does not fully type ------------------------- */

interface LayoutShiftEntry extends PerformanceEntry {
  value: number
  hadRecentInput: boolean
  sources?: Array<{ node?: Node | null }>
}

interface EventTimingEntry extends PerformanceEntry {
  processingStart: number
  processingEnd: number
  target?: Node | null
}

function describe(node: Node | null | undefined): string {
  if (!node || !(node instanceof Element)) return 'unknown'
  const el = node as HTMLElement
  // Prefer something a developer can actually locate in the tree.
  const testId = el.dataset?.widgetId
  if (testId) return `widget:${testId}`
  const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 2).join('.') : ''
  return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`
}

let started = false

/** Idempotent: React 19 StrictMode mounts effects twice in development. */
export function startPerfMonitoring(): void {
  if (started || typeof PerformanceObserver === 'undefined') return
  started = true

  const observe = (type: string, cb: (entries: PerformanceEntryList) => void) => {
    try {
      const obs = new PerformanceObserver((list) => cb(list.getEntries()))
      // `buffered` replays entries recorded before this ran, so shifts during
      // the initial paint are not missed.
      obs.observe({ type, buffered: true } as PerformanceObserverInit)
    } catch {
      // Safari lacks longtask; a missing observer must not break the others.
    }
  }

  observe('layout-shift', (entries) => {
    let added = 0
    const shifts: ShiftRecord[] = []
    for (const entry of entries as LayoutShiftEntry[]) {
      // Shifts within 500ms of a user input are expected (opening a drawer) and
      // are excluded from CLS by the spec.
      if (entry.hadRecentInput) continue
      added += entry.value
      shifts.push({
        value: entry.value,
        at: Math.round(entry.startTime),
        source: describe(entry.sources?.[0]?.node),
      })
    }
    if (shifts.length === 0) return
    commit({
      cls: state.cls + added,
      shifts: [...shifts, ...state.shifts].slice(0, MAX_RECORDS),
    })
  })

  observe('longtask', (entries) => {
    let count = 0
    let longest = state.longestTask
    for (const entry of entries) {
      count++
      longest = Math.max(longest, entry.duration)
    }
    if (count === 0) return
    commit({ longTasks: state.longTasks + count, longestTask: longest })
  })

  try {
    const obs = new PerformanceObserver((list) => {
      const records: InteractionRecord[] = []
      let slowest = state.slowestInteraction
      for (const entry of list.getEntries() as EventTimingEntry[]) {
        records.push({
          name: entry.name,
          duration: Math.round(entry.duration),
          target: describe(entry.target),
        })
        slowest = Math.max(slowest, entry.duration)
      }
      if (records.length === 0) return
      commit({
        interactions: [...records, ...state.interactions].slice(0, MAX_RECORDS),
        slowestInteraction: Math.round(slowest),
      })
    })
    // 16ms ≈ one frame: anything slower than this is worth seeing, well below
    // the 100ms budget we are trying to prove.
    obs.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
  } catch {
    /* event timing unsupported */
  }
}

/**
 * Times a synchronous block and records it.
 *
 * Used for schema validation, which is the one expensive thing this app does on
 * the main thread that no browser metric attributes to us specifically.
 */
export function measureSync<T>(label: string, size: number | undefined, fn: () => T): T {
  if (typeof performance === 'undefined') return fn()
  const start = performance.now()
  const result = fn()
  const duration = performance.now() - start
  // Sub-millisecond work is noise; recording it would bury the signal.
  if (duration >= 0.5) {
    commit({ parses: [{ label, duration, size }, ...state.parses].slice(0, MAX_RECORDS) })
  }
  return result
}
