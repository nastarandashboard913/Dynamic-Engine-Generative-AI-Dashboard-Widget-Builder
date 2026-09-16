import { TrendingDown, TrendingUp } from 'lucide-react'
import { Sparkline } from '@/components/Sparkline'
import { WidgetCard } from '@/components/WidgetCard'
import type { WidgetProps } from '@/features/registry/types'
import { cn } from '@/lib/cn'
import type { MetricCardData, Status } from '@/types/schema'

const ACCENT: Record<Status, string> = {
  success: 'text-success',
  warning: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-text-muted',
}

export function MetricCard({ title, data }: WidgetProps<MetricCardData>) {
  const { value, unit, trend, caption, status, sparkline } = data

  // In the reference, a downward move on a risk metric is an improvement, so
  // direction alone does not decide the colour — the payload's status does.
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown

  return (
    <WidgetCard className="group">
      {/* A KPI needs a small uppercase label, not an <h3>. Composing the header
       *  means using the card's own Label part — under the previous API the
       *  only way to get this treatment was to suppress the header entirely and
       *  rebuild one in the body, which silently cost this widget its menu. */}
      <WidgetCard.Header className="pb-1">
        <WidgetCard.Label>{title}</WidgetCard.Label>
        <WidgetCard.Actions>
          <WidgetCard.Menu className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" />
        </WidgetCard.Actions>
      </WidgetCard.Header>

      <WidgetCard.Body className="flex flex-col justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="numeric text-metric font-semibold text-text">{value}</span>
            {unit && <span className="text-xs text-text-muted">{unit}</span>}
          </div>

          {/* Fixed-height slot: a metric with a trend and one without must not
           *  produce cards of different heights in the same row. */}
          <div className="mt-2 h-4">
            {trend ? (
              <span
                className={cn('inline-flex items-center gap-1 text-xs font-medium', ACCENT[status])}
              >
                <TrendIcon className="size-icon-xs" strokeWidth={2.5} />
                <span className="numeric">{trend.pct}</span>
              </span>
            ) : caption ? (
              <span className="text-xs text-text-muted">{caption}</span>
            ) : null}
          </div>
        </div>

        {sparkline.length > 1 && (
          <div
            className={cn(
              '-mx-1 mt-3 h-8 opacity-45 transition-opacity duration-300',
              'group-hover:opacity-80',
              ACCENT[status],
            )}
          >
            <Sparkline points={sparkline} className="h-full w-full" />
          </div>
        )}
      </WidgetCard.Body>
    </WidgetCard>
  )
}
