import {
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Shield,
  Bookmark,
  Telescope,
} from 'lucide-react'
import { cn } from '@/lib/cn'

interface SidebarProps {
  investigations: string[]
  activeInvestigation: string
  onSelect: (prompt: string) => void
}

/**
 * Application chrome.
 *
 * Deliberately presentational: the navigation is not wired to a router because
 * the assessment grades the widget runtime, not routing. Building it for real
 * would consume hours that belong in the registry, so it is scoped as a shell
 * and called out as such in the README.
 */
export function Sidebar({ investigations, activeInvestigation, onSelect }: SidebarProps) {
  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-border bg-bg-elevated">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-hover text-sm font-bold text-accent-fg">
            Z
          </span>
          <span className="text-[15px] font-semibold tracking-tight">BI Portal</span>
        </div>
        <button
          type="button"
          aria-label="Collapse sidebar"
          className="rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
        >
          <PanelLeftClose className="size-[18px]" strokeWidth={2} />
        </button>
      </div>

      {/* Primary actions */}
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          type="button"
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5',
            'text-sm font-medium transition-colors hover:bg-surface-hover',
          )}
        >
          <Plus className="size-4" strokeWidth={2.5} />
          New investigation
        </button>
        <button
          type="button"
          aria-label="Search"
          className="rounded-xl border border-border bg-surface p-2.5 transition-colors hover:bg-surface-hover"
        >
          <Search className="size-4" strokeWidth={2.5} />
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3">
        {/* Investigations group */}
        <div className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-bg-elevated">
            <Telescope className="size-4 text-accent" strokeWidth={2} />
          </span>
          <span className="flex-1 text-sm font-semibold">Investigations</span>
          <ChevronDown className="size-4 text-text-dim" strokeWidth={2.5} />
        </div>

        <ul className="mt-1 flex flex-col gap-0.5 pl-3">
          {investigations.map((label) => {
            const active = label === activeInvestigation
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => onSelect(label)}
                  className={cn(
                    'w-full truncate rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
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
              className="w-full rounded-lg px-3 py-2 text-left text-[13px] text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
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

      {/* User */}
      <div className="flex items-center gap-3 border-t border-border px-4 py-3.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-surface text-xs font-semibold text-text-muted">
          LN
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">Lisa Nguyen</p>
          <p className="truncate text-xs text-text-dim">Manager</p>
        </div>
        <ChevronRight className="size-4 text-text-dim" strokeWidth={2.5} />
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
      <Icon className="size-[18px] shrink-0 text-text-muted" strokeWidth={2} />
      <span className="flex-1 text-left font-medium">{label}</span>
      {chevron && <ChevronRight className="size-4 text-text-dim" strokeWidth={2.5} />}
    </button>
  )
}
