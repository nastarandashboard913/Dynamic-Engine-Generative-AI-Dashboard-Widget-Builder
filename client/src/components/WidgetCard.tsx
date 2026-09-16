import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Braces, CheckCircle2, MoreVertical } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useWidgetEnvelope } from '@/features/registry/WidgetContext'
import { WidgetInspector } from '@/features/registry/WidgetInspector'
import { cn } from '@/lib/cn'

interface WidgetCardProps {
  title?: string
  subtitle?: string
  children: ReactNode
  /** The green "verified" mark the reference UI puts on generated widgets. */
  verified?: boolean
  className?: string
  /** Body padding is opt-out so the table can run its rows edge to edge. */
  bodyClassName?: string
  actions?: ReactNode
}

/**
 * Shared card chrome. Every archetype renders inside one of these so that
 * spacing, radius, border and header layout are defined once rather than
 * re-derived (and drifting) per widget.
 */
export function WidgetCard({
  title,
  subtitle,
  children,
  verified = true,
  className,
  bodyClassName,
  actions,
}: WidgetCardProps) {
  const hasHeader = Boolean(title || subtitle || actions)
  // Null when rendered outside a widget (e.g. in isolation or a test), in which
  // case the menu simply has nothing to offer and is not rendered.
  const envelope = useWidgetEnvelope()
  const [inspecting, setInspecting] = useState(false)

  return (
    <section
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface',
        'shadow-card transition-colors duration-200',
        className,
      )}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && (
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-text">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-text-muted">{subtitle}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 text-text-dim">
            {actions}
            {verified && (
              <CheckCircle2
                aria-label="Verified output"
                className="size-[18px] text-success"
                strokeWidth={2}
              />
            )}
            {envelope && (
              <>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label={title ? `Options for ${title}` : 'Widget options'}
                      className="rounded-md p-0.5 transition-colors hover:bg-surface-hover hover:text-text"
                    >
                      <MoreVertical className="size-[18px]" strokeWidth={2} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      className="pop-anim z-50 min-w-[180px] rounded-xl border border-border bg-bg-elevated p-1.5 shadow-float"
                    >
                      <DropdownMenu.Item
                        onSelect={() => setInspecting(true)}
                        className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none transition-colors data-[highlighted]:bg-surface-hover"
                      >
                        <Braces className="size-4 text-text-muted" strokeWidth={2} />
                        Inspect schema
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                <WidgetInspector
                  envelope={envelope}
                  open={inspecting}
                  onOpenChange={setInspecting}
                />
              </>
            )}
          </div>
        </header>
      )}

      <div className={cn('min-h-0 flex-1', hasHeader ? 'px-5 pb-5' : 'p-5', bodyClassName)}>
        {children}
      </div>
    </section>
  )
}
