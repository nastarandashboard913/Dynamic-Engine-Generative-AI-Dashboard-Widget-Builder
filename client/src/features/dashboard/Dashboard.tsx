import { AlertCircle, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WidgetGrid } from '@/features/layout/WidgetGrid'
import type { useDashboardStream } from '@/hooks/useDashboardStream'
import { useToast } from '@/hooks/useToast'
import { postWidgetAction } from '@/lib/api'

type Stream = ReturnType<typeof useDashboardStream>

interface DashboardProps {
  stream: Stream
}

export function Dashboard({ stream }: DashboardProps) {
  const { status, placeholders, widgets, error, meta } = stream
  const [order, setOrder] = useState<string[]>([])
  const toast = useToast()
  // Holds the last server-confirmed order so a rejected drag can be undone.
  const confirmedOrder = useRef<string[]>([])

  // Adopt the stream's order whenever a new plan arrives.
  useEffect(() => {
    const ids = placeholders.map((p) => p.id)
    setOrder((prev) => {
      // Preserve a user's manual arrangement across widget arrivals within the
      // same stream; reset only when the plan itself changes.
      const isSamePlan = prev.length > 0 && ids.every((id) => prev.includes(id))
      return isSamePlan ? prev : ids
    })
    confirmedOrder.current = ids
  }, [placeholders])

  /**
   * Optimistic reorder. The grid settles into the new arrangement immediately,
   * the layout change is persisted behind it, and a rejection animates back to
   * the previous order with a toast rather than leaving the UI lying about
   * server state.
   */
  const handleReorder = useCallback(
    async (next: string[]) => {
      const previous = confirmedOrder.current
      setOrder(next)

      try {
        await postWidgetAction({
          widgetId: 'dashboard',
          action: 'reorder',
          payload: { order: next },
        })
        confirmedOrder.current = next
      } catch (err) {
        setOrder(previous)
        toast.push({
          tone: 'error',
          title: 'Layout reverted',
          detail:
            err instanceof Error ? err.message : 'The server rejected the new arrangement.',
        })
      }
    },
    [toast],
  )

  if (status === 'idle') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <Sparkles className="size-7 text-accent" strokeWidth={1.75} />
        <h2 className="text-lg font-semibold tracking-tight">Ask a question to begin</h2>
        <p className="max-w-sm text-sm text-text-muted">
          Describe what you want to investigate and the workspace will assemble itself
          from the widgets the model returns.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <AlertCircle className="size-7 text-danger" strokeWidth={1.75} />
        <h2 className="text-lg font-semibold tracking-tight">Could not generate dashboard</h2>
        <p className="max-w-sm text-sm text-text-muted">{error}</p>
      </div>
    )
  }

  return (
    <WidgetGrid
      layout={meta?.layout ?? 'grid-3-col'}
      placeholders={placeholders}
      widgets={widgets}
      order={order}
      onReorder={handleReorder}
    />
  )
}
