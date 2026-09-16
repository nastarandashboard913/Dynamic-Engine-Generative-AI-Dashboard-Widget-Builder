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
    <WidgetCard verified={false} className="group" bodyClassName="flex flex-col justify-between">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-dim">
          {title}
        </p>

        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="numeric text-[30px] font-semibold leading-none text-text">
            {value}
          </span>
          {unit && <span className="text-xs text-text-muted">{unit}</span>}
        </div>

        <div className="mt-2 h-4">
          {trend ? (
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', ACCENT[status])}>
              <TrendIcon className="size-3.5" strokeWidth={2.5} />
              <span className="numeric">{trend.pct}</span>
            </span>
          ) : caption ? (
            <span className="text-xs text-text-muted">{caption}</span>
          ) : null}
        </div>
      </div>

      {sparkline.length > 1 && (
        <div className={cn('-mx-1 mt-3 h-8 opacity-45 transition-opacity duration-300', 'group-hover:opacity-80', ACCENT[status])}>
          <Sparkline points={sparkline} className="h-full w-full" />
        </div>
      )}
    </WidgetCard>
  )
}
