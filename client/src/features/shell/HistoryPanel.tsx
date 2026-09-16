import { ChevronRight, Clock, MessageSquare, MoreVertical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchInvestigations } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { Investigation } from '@/types/schema'

interface HistoryPanelProps {
  activeId: string | null
  onSelect: (prompt: string) => void
  /** Drawer state. Only meaningful below `xl`, where the panel overlays. */
  open: boolean
  onClose: () => void
}

/** "3 min ago" — relative timestamps read better than absolute ones in a feed. */
function relativeTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * Investigation history.
 *
 * Mirrors the sidebar's responsive strategy — static from `xl`, overlay drawer
 * below — but at a wider breakpoint. It is the lowest-priority column, so it is
 * the first to fold: between `lg` and `xl` the sidebar is still docked while
 * this one has already become a drawer.
 */
export function HistoryPanel({ activeId, onSelect, open, onClose }: HistoryPanelProps) {
  const [items, setItems] = useState<Investigation[]>([])

  useEffect(() => {
    const controller = new AbortController()
    fetchInvestigations(controller.signal)
      .then((res) => setItems(res.items))
      // A failed history fetch must not take down the workspace; the panel
      // simply stays empty.
      .catch(() => {})
    return () => controller.abort()
  }, [])

  return (
    <aside
      aria-label="Investigation history"
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex h-full w-history shrink-0 flex-col',
        'border-l border-border bg-bg-elevated',
        // See Sidebar: `transition-all` keeps the panel visible for the whole
        // slide-out, and `invisible` keeps the closed drawer out of the tab order.
        'transition-all duration-300 ease-out-soft',
        open ? 'visible translate-x-0' : 'invisible translate-x-full',
        'xl:visible xl:static xl:translate-x-0 xl:transition-none',
      )}
    >
      <header className="flex items-center gap-2 px-5 py-4">
        <Clock className="size-icon text-text-muted" strokeWidth={2} />
        <h2 className="flex-1 text-title font-semibold tracking-tight">Investigation History</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ChevronRight className="size-icon-sm" strokeWidth={2.5} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
        {items.map((item, i) => {
          // The reference design elevates only the current investigation.
          const active = activeId ? item.id === activeId : i === 0

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.prompt)}
              className={cn(
                'group w-full rounded-xl px-3 py-3 text-left transition-colors',
                active
                  ? 'border border-border bg-surface'
                  : 'border border-transparent hover:bg-surface-hover',
              )}
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="mt-0.5 size-icon-xs shrink-0 text-text-dim" strokeWidth={2} />
                <span className="flex-1" />
                <MoreVertical
                  className="size-icon-xs shrink-0 text-text-dim opacity-0 transition-opacity group-hover:opacity-100"
                  strokeWidth={2}
                />
              </div>
              <p className="mt-1.5 text-body leading-snug text-text">{item.prompt}</p>
              <p className="mt-1.5 text-mini text-text-dim">{relativeTime(item.createdAt)}</p>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
