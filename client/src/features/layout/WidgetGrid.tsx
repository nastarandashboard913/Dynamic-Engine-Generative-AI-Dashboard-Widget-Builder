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
import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'
import { WidgetRenderer } from '@/features/registry/WidgetRenderer'
import { WidgetSkeleton } from '@/features/registry/WidgetSkeleton'
import type { Placeholder, WidgetEnvelope } from '@/types/schema'
import { SortableWidget } from './SortableWidget'

interface WidgetGridProps {
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
export function WidgetGrid({ placeholders, widgets, order, onReorder }: WidgetGridProps) {
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ordered.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-12 gap-4">
          <AnimatePresence initial={false}>
            {ordered.map((placeholder) => {
              const widget = widgets.get(placeholder.id)

              return (
                <SortableWidget
                  key={placeholder.id}
                  id={placeholder.id}
                  span={placeholder.layout.span}
                  disabled={!widget}
                >
                  {/* Deliberately NOT a `layout` animation. dnd-kit already
                   *  drives reorder with its own transform + transition on the
                   *  sortable wrapper; adding Framer's layout animation here
                   *  would animate the same property from two sources and make
                   *  drags jitter. */}
                  <div
                    // The reserved height lives on this wrapper, so it applies
                    // to the skeleton AND the real widget. Content swapping in
                    // cannot change the cell's footprint.
                    style={{ minHeight: placeholder.layout.minHeight }}
                    className="h-full"
                  >
                    {widget ? (
                      // Fade only — no y-offset, no scale. Movement here would
                      // read as the layout settling, which is the exact
                      // impression the reserved geometry exists to avoid.
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        className="h-full"
                      >
                        <WidgetRenderer envelope={widget} />
                      </motion.div>
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
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  )
}
