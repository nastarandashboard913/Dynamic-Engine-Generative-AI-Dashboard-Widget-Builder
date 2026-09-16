import { useMemo, useState } from 'react'
import { WidgetCard } from '@/components/WidgetCard'
import type { WidgetProps } from '@/features/registry/types'
import { cn } from '@/lib/cn'
import type { DistributionChartData } from '@/types/schema'

/**
 * Histogram, built from flex children rather than SVG.
 *
 * For bars specifically, DOM elements beat SVG: they size themselves with
 * percentages, so the chart is responsive with no resize observer, no viewBox
 * maths and no re-render on container resize. Heights are the only inline
 * style, and they are set once from data.
 */
export function DistributionChart({ title, data }: WidgetProps<DistributionChartData>) {
  const [hovered, setHovered] = useState<number | null>(null)

  const max = useMemo(
    () => data.bins.reduce((m, b) => Math.max(m, b.count), 0) || 1,
    [data.bins],
  )

  const active = hovered !== null ? data.bins[hovered] : null

  return (
    <WidgetCard title={title} bodyClassName="flex flex-col">
      {/* Fixed-height readout row. Reserving it unconditionally means hovering a
       *  bar cannot resize the chart underneath the cursor. */}
      <div className="h-5 shrink-0 text-xs text-text-muted">
        {active ? (
          <span className="numeric">
            {active.label} — {active.count.toLocaleString()} accounts
          </span>
        ) : (
          <span className="text-text-dim">{data.xLabel}</span>
        )}
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-end gap-0.5 pt-2"
        onMouseLeave={() => setHovered(null)}
        role="img"
        aria-label={`${title ?? 'Distribution'}: ${data.bins.length} bins, peak ${max.toLocaleString()}`}
      >
        {data.bins.map((bin, i) => {
          const pct = (bin.count / max) * 100
          const isPeak = i === data.peakIndex
          const isHovered = hovered === i

          return (
            <div
              key={bin.label}
              onMouseEnter={() => setHovered(i)}
              className="group relative flex h-full flex-1 cursor-pointer items-end"
            >
              <div
                className={cn(
                  'w-full rounded-t-xs transition-all duration-200',
                  isPeak ? 'bg-chart-bar-peak' : 'bg-chart-bar',
                  hovered !== null && !isHovered ? 'opacity-40' : 'opacity-100',
                )}
                style={{
                  // Floor at 2% so an empty bin still reads as a bin.
                  height: `${Math.max(pct, 2)}%`,
                  // The warm bloom under the bars in the reference design.
                  filter: isHovered ? 'brightness(1.15)' : undefined,
                }}
              />
            </div>
          )
        })}

        {/* Decorative glow. Sits behind the bars, never in layout flow. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 opacity-40 blur-2xl hc:hidden"
          style={{ background: 'linear-gradient(to top, var(--chart-bar), transparent)' }}
        />
      </div>
    </WidgetCard>
  )
}
