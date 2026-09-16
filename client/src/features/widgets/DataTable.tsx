import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { WidgetCard } from '@/components/WidgetCard'
import type { WidgetProps } from '@/features/registry/types'
import { cn } from '@/lib/cn'
import type { DataTableData } from '@/types/schema'

const ROW_HEIGHT = 44

interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

/**
 * Sortable, filterable, virtualised table.
 *
 * The dataset is ~5,000 rows. Rendering that as DOM is roughly 25,000 cells and
 * makes both the initial paint and every keystroke in the filter box visibly
 * janky, so only the visible window is mounted.
 *
 * Row height is FIXED at 44px, which is a deliberate simplification. Variable
 * heights would need measurement per row, and measurement during a stream is
 * precisely what causes layout shift. A fixed height means the scroll area's
 * total size is known from `count * ROW_HEIGHT` before a single row mounts.
 */
export function DataTable({ title, data }: WidgetProps<DataTableData>) {
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keeps the input responsive while filtering a large list: React renders the
  // keystroke at high priority and the filtered result at low priority.
  const deferredFilter = useDeferredValue(filter)

  const rows = useMemo(() => {
    const needle = deferredFilter.trim().toLowerCase()

    let out = data.rows
    if (needle) {
      out = out.filter((row) => String(row[data.filterKey] ?? '').toLowerCase().includes(needle))
    }

    if (sort) {
      // Copy before sorting: sorting `data.rows` in place would mutate the
      // validated payload and make the operation unrepeatable.
      out = [...out].sort((a, b) => {
        const av = a[sort.key]
        const bv = b[sort.key]
        // Numeric-aware compare so "SAR 5.1M" and "0.93" order sensibly rather
        // than lexicographically.
        const an = typeof av === 'number' ? av : Number(String(av).replace(/[^0-9.-]/g, ''))
        const bn = typeof bv === 'number' ? bv : Number(String(bv).replace(/[^0-9.-]/g, ''))
        const cmp =
          Number.isFinite(an) && Number.isFinite(bn)
            ? an - bn
            : String(av).localeCompare(String(bv))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }

    return out
  }, [data.rows, data.filterKey, deferredFilter, sort])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key !== key ? { key, dir: 'desc' } : prev.dir === 'desc' ? { key, dir: 'asc' } : null,
    )
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const gridTemplate = data.columns
    .map((c) => (c.key === data.filterKey ? 'minmax(160px, 2.2fr)' : 'minmax(90px, 1fr)'))
    .join(' ')

  return (
    <WidgetCard
      title={title}
      bodyClassName="flex flex-col min-h-0"
      actions={
        <div className="relative mr-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-icon-xs -translate-y-1/2 text-text-dim" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={data.filterPlaceholder}
            aria-label={data.filterPlaceholder}
            className={cn(
              'w-44 rounded-chip border border-border bg-surface-sunken py-1.5 pl-8 pr-2.5',
              'text-xs text-text placeholder:text-text-dim',
              'transition-all duration-200 focus:w-56 focus:border-border-strong',
            )}
          />
        </div>
      }
    >
      {/* Header is a sibling of the scroll container, not sticky inside it.
       *  Sticky positioning inside a virtualised list fights the transform the
       *  virtualizer applies to its inner element. */}
      <div
        className="grid shrink-0 gap-4 border-b border-border px-1 pb-2.5"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {data.columns.map((col) => {
          const isSorted = sort?.key === col.key
          return (
            <button
              key={col.key}
              type="button"
              disabled={!col.sortable}
              onClick={() => col.sortable && toggleSort(col.key)}
              className={cn(
                'flex items-center gap-1 text-micro font-medium uppercase tracking-label',
                'transition-colors',
                col.align === 'right' && 'justify-end',
                col.sortable ? 'cursor-pointer hover:text-text' : 'cursor-default',
                isSorted ? 'text-text' : 'text-text-dim',
              )}
            >
              {col.label}
              {isSorted &&
                (sort.dir === 'asc' ? (
                  <ArrowUp className="size-3" strokeWidth={2.5} />
                ) : (
                  <ArrowDown className="size-3" strokeWidth={2.5} />
                ))}
            </button>
          )
        })}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">
            No rows match “{deferredFilter}”.
          </p>
        ) : (
          // Spacer div owns the full scroll height so the scrollbar reflects the
          // whole dataset, not just the mounted window.
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null

              return (
                <div
                  key={virtualRow.key}
                  className="absolute inset-x-0 top-0 grid items-center gap-4 border-b border-border/60 px-1 transition-colors hover:bg-surface-hover"
                  style={{
                    height: ROW_HEIGHT,
                    gridTemplateColumns: gridTemplate,
                    // translateY rather than `top`: transforms are composited
                    // and do not trigger layout on scroll.
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {data.columns.map((col) => (
                    <span
                      key={col.key}
                      className={cn(
                        'truncate text-body',
                        col.numeric && 'numeric',
                        col.align === 'right' && 'text-right',
                        col.key === data.filterKey
                          ? 'font-medium text-text'
                          : 'text-text-muted',
                      )}
                    >
                      {row[col.key]}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="shrink-0 pt-2.5 text-micro text-text-dim">
        <span className="numeric">{rows.length.toLocaleString()}</span> of{' '}
        <span className="numeric">{data.rows.length.toLocaleString()}</span> accounts
        {virtualizer.getVirtualItems().length > 0 && (
          <>
            {' · '}
            <span className="numeric">{virtualizer.getVirtualItems().length}</span> rows in DOM
          </>
        )}
      </p>
    </WidgetCard>
  )
}
