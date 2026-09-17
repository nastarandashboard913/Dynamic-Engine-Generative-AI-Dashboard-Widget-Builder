import { Check } from 'lucide-react'
import { useMemo } from 'react'
import { WidgetCard } from '@/components/WidgetCard'
import type { WidgetProps } from '@/features/registry/types'
import { useOptimisticAction } from '@/hooks/useOptimisticAction'
import { cn } from '@/lib/cn'
import type { ChecklistData } from '@/types/schema'

/**
 * Recommended actions. The clearest demonstration of the optimistic path:
 * the checkbox flips instantly, the request goes out behind it, and a rejection
 * flips it back with a toast rather than freezing the control mid-interaction.
 */
export function Checklist({ id, title, data }: WidgetProps<ChecklistData>) {
  const initial = useMemo(
    () => Object.fromEntries(data.items.map((i) => [i.id, i.done])),
    [data.items],
  )

  const { state, pending, commit } = useOptimisticAction<boolean>({ widgetId: id, initial })

  const doneCount = Object.values(state).filter(Boolean).length

  return (
    <WidgetCard>
      <WidgetCard.Header>
        <WidgetCard.Title>{title}</WidgetCard.Title>
        <WidgetCard.Actions>
          <span className="numeric text-xs text-text-dim">
            {doneCount}/{data.items.length}
          </span>
          <WidgetCard.Verified />
          <WidgetCard.Menu />
        </WidgetCard.Actions>
      </WidgetCard.Header>

      <WidgetCard.Body>
        <ul className="flex flex-col gap-1">
        {data.items.map((item) => {
          const checked = state[item.id] ?? false
          const isPending = pending.has(item.id)

          return (
            <li key={item.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => void commit(item.id, !checked, { action: 'toggle', label: item.label })}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left',
                  'transition-colors duration-150 hover:bg-surface-hover',
                  // Pending is signalled by a slight fade, not a spinner or a
                  // disabled state — the interaction must stay responsive.
                  isPending && 'opacity-70',
                )}
              >
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200',
                    checked
                      ? 'border-success bg-success/15 text-success'
                      : 'border-border-strong text-transparent group-hover:border-text-dim',
                  )}
                >
                  <span
                    className={cn(
                      'transition-all duration-200 ease-out-soft',
                      checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
                    )}
                  >
                    <Check className="size-3" strokeWidth={3.5} />
                  </span>
                </span>

                <span
                  className={cn(
                    'text-sm transition-colors duration-200',
                    checked ? 'text-text-dim line-through' : 'text-text',
                  )}
                >
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
        </ul>
      </WidgetCard.Body>
    </WidgetCard>
  )
}
