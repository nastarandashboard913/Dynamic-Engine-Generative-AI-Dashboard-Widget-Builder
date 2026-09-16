import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { spanToClass } from './spans'

interface SortableWidgetProps {
  id: string
  span: number
  children: ReactNode
  /** Skeletons are placeholders for absent content and must not be draggable. */
  disabled?: boolean
}

/**
 * Wraps one grid cell with drag-to-reorder.
 *
 * Dragging is bound to an explicit HANDLE rather than the card body. Widgets own
 * scroll areas, sliders and text inputs; making the whole card a drag source
 * would steal the pointer from every one of them. The handle appears on hover
 * and on keyboard focus, so it is reachable without a mouse.
 */
export function SortableWidget({ id, span, children, disabled }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        // dnd-kit drives position with transforms — composited, no layout work
        // per frame, which is what keeps a drag at 60fps with a 5,000-row table
        // on screen.
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group/cell relative min-w-0',
        spanToClass(span),
        // Lift the dragged item above its neighbours and drop its opacity so the
        // gap it will land in stays readable.
        isDragging && 'z-20 opacity-80',
      )}
    >
      {!disabled && (
        <button
          type="button"
          aria-label="Reorder widget"
          {...attributes}
          {...listeners}
          className={cn(
            'absolute -left-1 top-2 z-10 cursor-grab touch-none rounded-md p-1 active:cursor-grabbing',
            'text-text-dim opacity-0 transition-opacity duration-150',
            'group-hover/cell:opacity-100 focus-visible:opacity-100',
            'hover:bg-surface-hover hover:text-text',
          )}
        >
          <GripVertical className="size-4" strokeWidth={2} />
        </button>
      )}
      {children}
    </div>
  )
}
