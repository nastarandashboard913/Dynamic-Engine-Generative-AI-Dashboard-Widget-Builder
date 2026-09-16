import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Braces, CheckCircle2, MoreVertical } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useWidgetEnvelope } from '@/features/registry/WidgetContext'
import { WidgetInspector } from '@/features/registry/WidgetInspector'
import { cn } from '@/lib/cn'
import type { WidgetEnvelope } from '@/types/schema'

/* ============================================================================
 * WidgetCard — compound component
 * ---------------------------------------------------------------------------
 * Shared card chrome, composed rather than configured.
 *
 * The previous shape was a single component taking `title`, `subtitle`,
 * `actions`, `verified`, `className` and `bodyClassName`. Every widget that
 * needed something other than the default had to reach past the component:
 * a boolean to switch chrome off, a second className to restyle internals, a
 * ReactNode prop to smuggle JSX into a slot. MetricCard could not use the
 * header at all — it needed a small uppercase label, not an <h3> — so it passed
 * `verified={false}`, omitted `title`, and rebuilt a header inside the body.
 * That silently cost it the inspector menu, which lives in the header.
 *
 * Here the caller owns the composition. The parts share state through context,
 * which is what makes this a compound component rather than a set of namespaced
 * divs: <Title>/<Label> register themselves as the card's accessible name, and
 * the root wires `aria-labelledby` to whichever one was actually rendered.
 * ========================================================================= */

interface CardContextValue {
  /** id the rendered label carries, referenced by the root's aria-labelledby. */
  labelId: string
  /** Called by Title/Label so the root knows an accessible name exists. */
  registerLabel: () => void
  /** The raw payload, for the inspector. Null outside a widget. */
  envelope: WidgetEnvelope | null
}

const CardContext = createContext<CardContextValue | null>(null)

function useCard(part: string): CardContextValue {
  const ctx = useContext(CardContext)
  if (!ctx) {
    throw new Error(`<WidgetCard.${part}> must be rendered inside <WidgetCard>`)
  }
  return ctx
}

/* --- Root ----------------------------------------------------------------- */

interface RootProps {
  children: ReactNode
  className?: string
}

function WidgetCardRoot({ children, className }: RootProps) {
  const labelId = useId()
  const [hasLabel, setHasLabel] = useState(false)
  const envelope = useWidgetEnvelope()

  const registerLabel = useCallback(() => setHasLabel(true), [])

  const value = useMemo<CardContextValue>(
    () => ({ labelId, registerLabel, envelope }),
    [labelId, registerLabel, envelope],
  )

  return (
    <CardContext.Provider value={value}>
      <section
        // Only points at the label once one has actually rendered. A dangling
        // aria-labelledby is worse than none: it names the region after nothing.
        aria-labelledby={hasLabel ? labelId : undefined}
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface',
          'shadow-card transition-colors duration-200',
          className,
        )}
      >
        {children}
      </section>
    </CardContext.Provider>
  )
}

/* --- Parts ---------------------------------------------------------------- */

function Header({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn('flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5', className)}
    >
      {children}
    </header>
  )
}

/** Default heading treatment: the widget's name as a proper heading. */
function Title({ children, className }: { children: ReactNode; className?: string }) {
  const { labelId, registerLabel } = useCard('Title')
  useEffect(() => registerLabel(), [registerLabel])

  return (
    <h3
      id={labelId}
      className={cn('truncate text-title font-semibold tracking-tight text-text', className)}
    >
      {children}
    </h3>
  )
}

/**
 * Alternative heading treatment: the small uppercase label a KPI card uses.
 * Same semantic role as Title, different visual weight — which is precisely the
 * choice the old API took away from the caller.
 */
function Label({ children, className }: { children: ReactNode; className?: string }) {
  const { labelId, registerLabel } = useCard('Label')
  useEffect(() => registerLabel(), [registerLabel])

  return (
    <p
      id={labelId}
      className={cn(
        'truncate text-micro font-medium uppercase tracking-label text-text-dim',
        className,
      )}
    >
      {children}
    </p>
  )
}

function Subtitle({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('mt-0.5 truncate text-mini text-text-muted', className)}>{children}</p>
}

/** Right-hand cluster. Replaces the old `actions` ReactNode prop. */
function Actions({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-1.5 text-text-dim', className)}>
      {children}
    </div>
  )
}

/** Rendered when present, omitted when not — replaces `verified={false}`. */
function Verified({ className }: { className?: string }) {
  return (
    <CheckCircle2
      aria-label="Verified output"
      className={cn('size-icon text-success', className)}
      strokeWidth={2}
    />
  )
}

/** The ⋯ menu and its schema inspector. Self-contained. */
function Menu({ className }: { className?: string }) {
  const { envelope } = useCard('Menu')
  const [inspecting, setInspecting] = useState(false)

  // Nothing to inspect outside a widget (isolation, tests) — render nothing
  // rather than an menu that opens onto an empty dialog.
  if (!envelope) return null

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={envelope.title ? `Options for ${envelope.title}` : 'Widget options'}
            className={cn(
              'rounded-md p-0.5 transition-colors hover:bg-surface-hover hover:text-text',
              className,
            )}
          >
            <MoreVertical className="size-icon" strokeWidth={2} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="pop-anim z-50 min-w-44 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-float"
          >
            <DropdownMenu.Item
              onSelect={() => setInspecting(true)}
              className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-body outline-none transition-colors data-[highlighted]:bg-surface-hover"
            >
              <Braces className="size-icon-sm text-text-muted" strokeWidth={2} />
              Inspect schema
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <WidgetInspector envelope={envelope} open={inspecting} onOpenChange={setInspecting} />
    </>
  )
}

/**
 * Padded content region. Callers pass their own layout here, which is what
 * removed the need for a `bodyClassName` escape hatch on the root.
 */
function Body({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-0 flex-1 px-4 pb-4 sm:px-5 sm:pb-5', className)}>{children}</div>
  )
}

/* --- Public API ----------------------------------------------------------- */

export const WidgetCard = Object.assign(WidgetCardRoot, {
  Header,
  Title,
  Label,
  Subtitle,
  Actions,
  Verified,
  Menu,
  Body,
})
