import type { CSSProperties } from 'react'
import { WidgetCard } from '@/components/WidgetCard'
import { cn } from '@/lib/cn'

interface WidgetSkeletonProps {
  /** Archetype being waited on — drives which silhouette we draw. */
  type: string
  title?: string
  /** Reserved height from the stream's `meta` event. */
  minHeight: number
}

const Bar = ({ className, style }: { className?: string; style?: CSSProperties }) => (
  <div className={cn('shimmer rounded-md', className)} style={style} />
)

/**
 * Type-aware skeletons ("skeleton drivers").
 *
 * A single grey rectangle would reserve the right space but still produce a
 * visible jolt when real content replaces it, because the internal rhythm
 * changes. Matching the silhouette per archetype means the swap only changes
 * colour and text, never structure — the eye reads it as content arriving
 * rather than the layout rearranging.
 */
export function WidgetSkeleton({ type, title, minHeight }: WidgetSkeletonProps) {
  return (
    <WidgetCard
      title={title}
      verified={false}
      className="animate-none"
      // The reserved height is applied here, before any data exists. Everything
      // downstream of this widget is already in its final position.
      bodyClassName="flex flex-col"
    >
      <div style={{ minHeight: minHeight - (title ? 64 : 40) }} aria-hidden>
        {renderSilhouette(type)}
      </div>
      <span className="sr-only">Loading {title ?? 'widget'}…</span>
    </WidgetCard>
  )
}

function renderSilhouette(type: string) {
  switch (type) {
    case 'NARRATIVE_HEADER':
      return (
        <div className="flex flex-col gap-3">
          <Bar className="h-8 w-[65%]" />
          <Bar className="h-4 w-[45%]" />
          <div className="mt-1 flex gap-2">
            <Bar className="h-7 w-32 rounded-chip" />
            <Bar className="h-7 w-52 rounded-chip" />
            <Bar className="h-7 w-28 rounded-chip" />
          </div>
        </div>
      )

    case 'METRIC_CARD':
      return (
        <div className="flex flex-col gap-2.5">
          <Bar className="h-3 w-20" />
          <Bar className="h-8 w-28" />
          <Bar className="h-3 w-14" />
        </div>
      )

    case 'DATA_TABLE':
      return (
        <div className="flex flex-col gap-3">
          <Bar className="h-8 w-64 rounded-chip" />
          <div className="flex flex-col gap-2 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Bar className="h-4 flex-[3]" />
                <Bar className="h-4 flex-[2]" />
                <Bar className="h-4 flex-[2]" />
                <Bar className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </div>
      )

    case 'CHECKLIST':
      return (
        <div className="flex flex-col gap-4 pt-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Bar className="size-5 shrink-0 rounded-full" />
              <Bar className="h-4" style={{ width: `${70 - i * 8}%` }} />
            </div>
          ))}
        </div>
      )

    case 'DISTRIBUTION_CHART':
      return (
        <div className="flex h-full items-end gap-1.5 pt-4">
          {[18, 30, 46, 62, 78, 92, 100, 88, 70, 54, 38, 24, 14].map((h, i) => (
            <Bar key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
          ))}
        </div>
      )

    case 'DYNAMIC_FORM':
      return (
        <div className="flex flex-col gap-5 pt-1">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bar className="h-3 w-32" />
              <Bar className="h-8 w-full rounded-chip" />
            </div>
          ))}
        </div>
      )

    default:
      return <Bar className="h-full w-full" />
  }
}
