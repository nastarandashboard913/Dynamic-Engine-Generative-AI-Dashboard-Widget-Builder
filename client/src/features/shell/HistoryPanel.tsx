import { ChevronRight, Clock, MessageSquare, MoreVertical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchInvestigations } from '@/lib/api'
import { cn } from '@/lib/cn'
import type { Investigation } from '@/types/schema'

interface HistoryPanelProps {
  activeId: string | null
  onSelect: (prompt: string) => void
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

export function HistoryPanel({ activeId, onSelect }: HistoryPanelProps) {
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
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-border bg-bg-elevated">
      <header className="flex items-center gap-2 px-5 py-4">
        <Clock className="size-[18px] text-text-muted" strokeWidth={2} />
        <h2 className="flex-1 text-[15px] font-semibold tracking-tight">Investigation History</h2>
        <button
          type="button"
          aria-label="Collapse history"
          className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ChevronRight className="size-4" strokeWidth={2.5} />
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
                <MessageSquare
                  className="mt-0.5 size-3.5 shrink-0 text-text-dim"
                  strokeWidth={2}
                />
                <span className="flex-1" />
                <MoreVertical
                  className="size-3.5 shrink-0 text-text-dim opacity-0 transition-opacity group-hover:opacity-100"
                  strokeWidth={2}
                />
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-text">{item.prompt}</p>
              <p className="mt-1.5 text-xs text-text-dim">{relativeTime(item.createdAt)}</p>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
