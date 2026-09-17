import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, type CSSProperties } from 'react'
import { WidgetRenderer } from '@/features/registry/WidgetRenderer'
import { WidgetSkeleton } from '@/features/registry/WidgetSkeleton'
import type { Placeholder, WidgetEnvelope } from '@/types/schema'
import { SortableWidget } from './SortableWidget'
import { snapSpan, type LayoutKind } from './spans'

interface WidgetGridProps {
  /** From the payload's `layout` field; decides how many columns widgets snap to. */
  layout: LayoutKind
  placeholders: Placeholder[]
  widgets: Map<string, WidgetEnvelope>
  order: string[]
  onReorder: (nextOrder: string[]) => void
}

/**
 * The auto-layout matrix.
 *
 * Renders from `placeholders` — the geometry that arrived in the stream's first
 * event — not from `widgets`. Every cell therefore exists at its final size
 * before any content does, and an arriving widget swaps a skeleton for content
 * inside a box that was already the right shape. Cumulative Layout Shift is
 * zero by construction rather than by tuning.
 */
export function WidgetGrid({ layout, placeholders, widgets, order, onReorder }: WidgetGridProps) {
  const sensors = useSensors(
    // A small activation distance keeps clicks inside widgets from being
    // interpreted as drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const ordered = useMemo(() => {
    const byId = new Map(placeholders.map((p) => [p.id, p]))
    const seen = new Set<string>()
    const out: Placeholder[] = []

    // Known order first, then anything the stream added afterwards.
    for (const id of order) {
      const p = byId.get(id)
      if (p) {
        out.push(p)
        seen.add(id)
      }
    }
    for (const p of placeholders) {
      if (!seen.has(p.id)) out.push(p)
    }
    return out
  }, [placeholders, order])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ids = ordered.map((p) => p.id)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return

    const next = [...ids]
    const [moved] = next.splice(from, 1)
    if (moved) next.splice(to, 0, moved)
    onReorder(next)
  }

  // Naming widgets in announcements is what makes keyboard dragging usable:
  // "Metric card moved to position 3 of 9" is navigable, "item moved" is not.
  const nameOf = (id: string | number) =>
    ordered.find((p) => p.id === String(id))?.title ??
    ordered.find((p) => p.id === String(id))?.type.replace(/_/g, ' ').toLowerCase() ??
    'widget'
  const positionOf = (id: string | number) => ordered.findIndex((p) => p.id === String(id)) + 1

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
      accessibility={{
        // KeyboardSensor makes dragging *possible* without a mouse; these make
        // it *discoverable*. Without them a screen-reader user focuses a drag
        // handle and is told nothing about how to use it.
        screenReaderInstructions: {
          draggable:
            'Press space or enter to pick up this widget. Use the arrow keys to move it. ' +
            'Press space or enter again to drop it, or escape to cancel.',
        },
        announcements: {
          onDragStart: ({ active }) =>
            `Picked up ${nameOf(active.id)}. Position ${positionOf(active.id)} of ${ordered.length}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `${nameOf(active.id)} is over position ${positionOf(over.id)} of ${ordered.length}.`
              : `${nameOf(active.id)} is no longer over a drop target.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `Dropped ${nameOf(active.id)} at position ${positionOf(over.id)} of ${ordered.length}.`
              : `Dropped ${nameOf(active.id)}. It was returned to its original position.`,
          onDragCancel: ({ active }) =>
            `Cancelled. ${nameOf(active.id)} was returned to its original position.`,
        },
      }}
    >
      <SortableContext items={ordered.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-12 gap-3 sm:gap-4">
          {ordered.map((placeholder) => {
              const widget = widgets.get(placeholder.id)

              return (
                <SortableWidget
                  key={placeholder.id}
                  id={placeholder.id}
                  span={snapSpan(placeholder.layout.span, layout)}
                  disabled={!widget}
                >
                  {/* Deliberately NOT a `layout` animation. dnd-kit already
                   *  drives reorder with its own transform + transition on the
                   *  sortable wrapper; adding Framer's layout animation here
                   *  would animate the same property from two sources and make
                   *  drags jitter. */}
                  <div
                    // Lets the performance overlay report *which* widget moved
                    // rather than an anonymous div.
                    data-widget-id={placeholder.id}
                    data-widget-type={placeholder.type}
                    // Reservation is passed as a custom property rather than an
                    // inline min-height so CSS can widen it per breakpoint. The
                    // server declares one number and cannot know the viewport;
                    // see `.widget-cell` in index.css.
                    style={{ '--reserved-h': `${placeholder.layout.minHeight}px` } as CSSProperties}
                    // Sizing lives entirely in `.widget-cell` — no `h-full`
                    // utility, which would outrank the component-layer rule that
                    // gives the table a definite height.
                    className="widget-cell"
                  >
                    {widget ? (
                      // Fade only — no y-offset, no scale. Movement here would
                      // read as the layout settling, which is the exact
                      // impression the reserved geometry exists to avoid.
                      <div className="widget-enter h-full">
                        <WidgetRenderer envelope={widget} />
                      </div>
                    ) : (
                      <WidgetSkeleton
                        type={placeholder.type}
                        title={placeholder.title}
                        minHeight={placeholder.layout.minHeight}
                      />
                    )}
                  </div>
                </SortableWidget>
              )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
