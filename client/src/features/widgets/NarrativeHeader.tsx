import { ChevronDown, Database, ShieldCheck, CircleCheck } from 'lucide-react'
import type { WidgetProps } from '@/features/registry/types'
import type { NarrativeHeaderData, Status } from '@/types/schema'
import { cn } from '@/lib/cn'

const ICONS = {
  verified: CircleCheck,
  database: Database,
  audit: ShieldCheck,
} as const

const TONE: Record<Status, string> = {
  success: 'text-success',
  warning: 'text-warn',
  danger: 'text-danger',
  neutral: 'text-text-muted',
}

/**
 * The generated answer itself — the most "LLM" surface in the app, and the only
 * widget that renders without card chrome. In the reference design it sits
 * directly on the canvas so the headline reads as the system speaking rather
 * than as one more panel among many.
 */
export function NarrativeHeader({ data }: WidgetProps<NarrativeHeaderData>) {
  return (
    <div className="px-1">
      <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-tight text-text sm:text-[32px]">
        {data.headline}
      </h1>

      <p className="mt-2 text-sm text-text-muted">{data.summary}</p>

      {data.chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {data.chips.map((chip) => {
            const Icon = ICONS[chip.icon]
            // Only the provenance chip is interactive in the reference UI.
            const expandable = chip.icon === 'database'
            return (
              <span
                key={chip.label}
                className={cn(
                  'inline-flex items-center gap-2 rounded-chip border border-border bg-surface/70 px-3 py-1.5',
                  'text-[13px] font-medium text-text backdrop-blur-sm transition-colors',
                  expandable && 'cursor-pointer hover:bg-surface-hover',
                )}
              >
                <Icon className={cn('size-[15px] shrink-0', TONE[chip.tone])} strokeWidth={2} />
                {chip.label}
                {expandable && <ChevronDown className="size-3.5 text-text-dim" strokeWidth={2.5} />}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
