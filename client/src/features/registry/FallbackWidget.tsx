import { AlertTriangle, FileQuestion, Bug } from 'lucide-react'
import { WidgetCard } from '@/components/WidgetCard'
import type { FallbackReason } from './types'

interface FallbackWidgetProps {
  title?: string
  reason: FallbackReason
  onRetry?: () => void
}

/**
 * What renders when a widget cannot. The design goal is that a broken widget
 * reads as a contained, explained gap — not as a crash and not as a silently
 * missing card. It keeps the same card chrome and the same reserved footprint,
 * so a failure never disturbs the surrounding layout.
 */
export function FallbackWidget({ title, reason, onRetry }: FallbackWidgetProps) {
  const { Icon, heading, detail } = describe(reason)

  return (
    <WidgetCard title={title} verified={false}>
      <div
        role="alert"
        className="flex h-full flex-col items-start justify-center gap-2 rounded-lg border border-dashed border-border-strong/70 px-4 py-5"
      >
        <div className="flex items-center gap-2 text-warn">
          <Icon className="size-4 shrink-0" strokeWidth={2} />
          <span className="text-sm font-medium">{heading}</span>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{detail}</p>

        {/* Validation issues are developer-facing: useful while building a new
         *  archetype, noise for an end user. */}
        {import.meta.env.DEV && reason.kind === 'invalid-payload' && reason.issues.length > 0 && (
          <ul className="mt-1 max-h-24 w-full overflow-auto rounded-md bg-surface-sunken px-3 py-2 font-mono text-[11px] leading-relaxed text-text-dim">
            {reason.issues.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        )}

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 rounded-chip border border-border px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
          >
            Try again
          </button>
        )}
      </div>
    </WidgetCard>
  )
}

function describe(reason: FallbackReason) {
  switch (reason.kind) {
    case 'unknown-type':
      return {
        Icon: FileQuestion,
        heading: 'Unsupported widget type',
        detail: `The server sent "${reason.type}", which this client has no renderer for. The rest of the dashboard is unaffected.`,
      }
    case 'invalid-payload':
      return {
        Icon: AlertTriangle,
        heading: 'Malformed widget data',
        detail: `A "${reason.type}" widget arrived with data that does not match its schema, so it was not rendered.`,
      }
    case 'render-error':
      return {
        Icon: Bug,
        heading: 'Widget failed to render',
        detail: `"${reason.type}" threw while rendering: ${reason.message}`,
      }
  }
}
