import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Shield,
  Telescope,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface SidebarProps {
  investigations: string[]
  activeInvestigation: string
  onSelect: (prompt: string) => void
  /** Drawer state. Only meaningful below `lg`, where the panel overlays. */
  open: boolean
  onClose: () => void
}

/**
 * Application chrome.
 *
 * Responsive strategy: ONE element, two behaviours, switched entirely in CSS.
 * From `lg` up it is a static flex child (`lg:static lg:translate-x-0`); below
 * that it becomes a fixed overlay drawer driven by a transform. No media-query
 * listener, no JS branch, and no second component to keep in sync — the only
 * JavaScript involved is the boolean that flips one class.
 *
 * Navigation is presentational: nothing is wired to a router. That is a scope
 * decision documented in the README, not an oversight.
 */
export function Sidebar({
  investigations,
  activeInvestigation,
  onSelect,
  open,
  onClose,
}: SidebarProps) {
  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex h-full w-sidebar shrink-0 flex-col',
        'border-r border-border bg-bg-elevated',
        // `transition-all` rather than `transition-transform` is deliberate:
        // visibility interpolates specially — if either endpoint is visible the
        // element stays visible for the whole transition — so the panel slides
        // out fully and only then hides. Transitioning transform alone would
        // make it vanish instantly on close.
        'transition-all duration-300 ease-out-soft',
        // `invisible` (visibility: hidden) rather than opacity or a transform
        // alone: it removes the closed drawer from the tab order. A panel that
        // is off-screen but still focusable is a keyboard trap.
        open ? 'visible translate-x-0' : 'invisible -translate-x-full',
        // From lg up the drawer mechanics switch off entirely.
        'lg:visible lg:static lg:translate-x-0 lg:transition-none',
      )}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-hover text-sm font-bold text-accent-fg">
            Z
          </span>
          <span className="text-title font-semibold tracking-tight">BI Portal</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text lg:hidden"
        >
          <PanelLeftClose className="size-icon" strokeWidth={2} />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          type="button"
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5',
            'text-sm font-medium transition-colors hover:bg-surface-hover',
          )}
        >
          <Plus className="size-icon-sm" strokeWidth={2.5} />
          New investigation
        </button>
        <button
          type="button"
          aria-label="Search"
          className="rounded-xl border border-border bg-surface p-2.5 transition-colors hover:bg-surface-hover"
        >
          <Search className="size-icon-sm" strokeWidth={2.5} />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-bg-elevated">
            <Telescope className="size-icon-sm text-accent" strokeWidth={2} />
          </span>
          <span className="flex-1 text-sm font-semibold">Investigations</span>
          <ChevronDown className="size-icon-sm text-text-dim" strokeWidth={2.5} />
        </div>

        <ul className="mt-1 flex flex-col gap-0.5 pl-3">
          {investigations.map((label) => {
            const active = label === activeInvestigation
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onSelect(label)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'w-full truncate rounded-lg px-3 py-2 text-left text-body transition-colors',
                    active
                      ? 'bg-surface font-medium text-text'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text',
                  )}
                >
                  {label}
                </button>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              className="w-full rounded-lg px-3 py-2 text-left text-body text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              View All
            </button>
          </li>
        </ul>

        <NavGroup icon={MessageSquare} label="Chat with Data" />
        <NavGroup icon={LayoutGrid} label="Dashboards" />

        <div className="my-2 border-t border-border" />

        <NavGroup icon={Bookmark} label="Saved Reports" />

        <div className="my-2 border-t border-border" />

        <NavGroup icon={Shield} label="Admin Console" chevron={false} />
        <NavGroup icon={Settings} label="Settings" chevron={false} />
      </nav>

      <div className="flex items-center gap-3 border-t border-border px-4 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-surface text-mini font-semibold text-text-muted">
          LN
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium">Lisa Nguyen</p>
          <p className="truncate text-mini text-text-dim">Manager</p>
        </div>
        <ChevronRight className="size-icon-sm text-text-dim" strokeWidth={2.5} />
      </div>
    </aside>
  )
}

function NavGroup({
  icon: Icon,
  label,
  chevron = true,
}: {
  icon: typeof MessageSquare
  label: string
  chevron?: boolean
}) {
  return (
    <button
      type="button"
      className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text transition-colors hover:bg-surface-hover"
    >
      <Icon className="size-icon shrink-0 text-text-muted" strokeWidth={2} />
      <span className="flex-1 text-left font-medium">{label}</span>
      {chevron && <ChevronRight className="size-icon-sm text-text-dim" strokeWidth={2.5} />}
    </button>
  )
}
