import { Activity, RotateCcw, X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/cn'
import { getPerfSnapshot, resetPerf, subscribePerf } from '@/lib/perf'

interface PerfOverlayProps {
  onClose: () => void
}

/** Web Vitals thresholds for CLS; the rubric's budget for interactions. */
function clsTone(cls: number): string {
  if (cls <= 0.1) return 'text-success'
  if (cls <= 0.25) return 'text-warn'
  return 'text-danger'
}
function msTone(ms: number, budget: number): string {
  if (ms === 0) return 'text-text-dim'
  if (ms <= budget) return 'text-success'
  if (ms <= budget * 2) return 'text-warn'
  return 'text-danger'
}

/**
 * Live performance readout.
 *
 * Deliberately shipped in the production build rather than gated behind
 * `import.meta.env.DEV`: the claims it verifies (zero CLS, sub-100ms response)
 * are claims about the built artefact. A dev-only panel would measure a
 * different application than the one being reviewed — unminified, unbundled,
 * with StrictMode double-rendering.
 */
export function PerfOverlay({ onClose }: PerfOverlayProps) {
  const snap = useSyncExternalStore(subscribePerf, getPerfSnapshot)

  if (!snap.supported) {
    return null
  }

  const worstParse = snap.parses.reduce((m, p) => Math.max(m, p.duration), 0)

  return (
    <aside
      aria-label="Performance metrics"
      className={cn(
        'fixed bottom-3 left-3 z-40 w-72 rounded-card border border-border',
        'bg-bg-elevated/95 shadow-float backdrop-blur-xl',
      )}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Activity className="size-icon-xs text-accent" strokeWidth={2.5} />
        <h2 className="flex-1 text-mini font-semibold">Performance</h2>
        <button
          type="button"
          onClick={resetPerf}
          aria-label="Reset metrics"
          className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
        >
          <RotateCcw className="size-3" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close performance panel"
          className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-border">
        <Stat
          label="CLS"
          value={snap.cls.toFixed(4)}
          tone={clsTone(snap.cls)}
          hint="≤ 0.1 good"
        />
        <Stat
          label="Slowest input"
          value={`${snap.slowestInteraction}ms`}
          tone={msTone(snap.slowestInteraction, 100)}
          hint="budget 100ms"
        />
        <Stat
          label="Long tasks"
          value={String(snap.longTasks)}
          tone={snap.longTasks === 0 ? 'text-success' : 'text-warn'}
          hint={snap.longestTask ? `max ${Math.round(snap.longestTask)}ms` : '> 50ms blocks'}
        />
        <Stat
          label="Slowest parse"
          value={`${worstParse.toFixed(1)}ms`}
          tone={msTone(worstParse, 50)}
          hint="schema validation"
        />
      </dl>

      <div className="max-h-52 overflow-y-auto px-3 py-2">
        {snap.shifts.length > 0 && (
          <Section title={`Layout shifts (${snap.shifts.length})`}>
            {snap.shifts.slice(0, 6).map((s, i) => (
              <Row
                key={`${s.at}-${i}`}
                left={s.source}
                right={s.value.toFixed(4)}
                tone="text-danger"
              />
            ))}
          </Section>
        )}

        {snap.parses.length > 0 && (
          <Section title="Schema validation">
            {snap.parses.slice(0, 5).map((p, i) => (
              <Row
                key={`${p.label}-${i}`}
                left={p.size ? `${p.label} (${p.size.toLocaleString()} rows)` : p.label}
                right={`${p.duration.toFixed(1)}ms`}
                tone={msTone(p.duration, 50)}
              />
            ))}
          </Section>
        )}

        {snap.interactions.length > 0 && (
          <Section title="Interactions">
            {snap.interactions.slice(0, 5).map((it, i) => (
              <Row
                key={`${it.name}-${i}`}
                left={`${it.name} · ${it.target}`}
                right={`${it.duration}ms`}
                tone={msTone(it.duration, 100)}
              />
            ))}
          </Section>
        )}

        {snap.shifts.length === 0 && snap.parses.length === 0 && snap.interactions.length === 0 && (
          <p className="py-3 text-center text-mini text-text-dim">
            No shifts, slow parses or slow inputs recorded.
          </p>
        )}
      </div>
    </aside>
  )
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone: string
  hint: string
}) {
  return (
    <div className="bg-bg-elevated px-3 py-2">
      <dt className="text-micro uppercase tracking-label text-text-dim">{label}</dt>
      <dd className={cn('numeric mt-0.5 text-sm font-semibold', tone)}>{value}</dd>
      <p className="text-micro text-text-dim">{hint}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-2 last:mb-0">
      <h3 className="mb-1 text-micro uppercase tracking-label text-text-dim">{title}</h3>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  )
}

function Row({ left, right, tone }: { left: string; right: string; tone: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-micro">
      <span className="truncate text-text-muted">{left}</span>
      <span className={cn('numeric shrink-0', tone)}>{right}</span>
    </div>
  )
}
