import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Check,
  ChevronDown,
  Clock,
  Contrast,
  Globe,
  Menu,
  Moon,
  MoreHorizontal,
  Share2,
  Sun,
  TriangleAlert,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { THEMES, THEME_LABELS, type Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

interface TopBarProps {
  breadcrumb: string[]
  theme: Theme
  onThemeChange: (t: Theme) => void
  injectFaults: boolean
  onInjectFaultsChange: (v: boolean) => void
  onOpenNav: () => void
  onOpenHistory: () => void
}

const THEME_ICONS: Record<Theme, typeof Sun> = {
  dark: Moon,
  light: Sun,
  hc: Contrast,
}

// `pop-anim` is defined in index.css. The previous `animate-in fade-in-0
// zoom-in-95` classes came from the tailwindcss-animate plugin, which is not
// installed — they compiled to nothing and the menu appeared instantly.
const menuPanel = cn(
  'pop-anim z-50 min-w-48 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-float',
)
const menuItem = cn(
  'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-body outline-none',
  'transition-colors data-[highlighted]:bg-surface-hover',
)
const iconBtn = 'rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text'

export function TopBar({
  breadcrumb,
  theme,
  onThemeChange,
  injectFaults,
  onInjectFaultsChange,
  onOpenNav,
  onOpenHistory,
}: TopBarProps) {
  const ThemeIcon = THEME_ICONS[theme]

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Drawer triggers exist only where the panel is actually a drawer. */}
        <button type="button" onClick={onOpenNav} aria-label="Open navigation" className={cn(iconBtn, 'lg:hidden')}>
          <Menu className="size-icon" strokeWidth={2} />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          {breadcrumb.map((crumb, i) => {
            const last = i === breadcrumb.length - 1
            return (
              <span key={crumb} className="flex min-w-0 items-center gap-2">
                {/* Only the final crumb survives on narrow screens; the trail
                 *  is context, the current page is the information. */}
                <span
                  className={cn(
                    'truncate',
                    last ? 'font-medium text-text' : 'hidden text-text-muted sm:inline',
                  )}
                >
                  {crumb}
                </span>
                {!last && <span className="hidden text-text-dim sm:inline">/</span>}
              </span>
            )
          })}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Progressive disclosure: the least essential controls leave first, so
         *  the bar stays usable at 375px without wrapping or scrolling. */}
        <Pill className="hidden lg:inline-flex">
          <span className="size-1.5 rounded-full bg-success" />
          neonDB
          <ChevronDown className="size-icon-xs text-text-dim" strokeWidth={2.5} />
        </Pill>

        <Pill className="hidden md:inline-flex">
          <Globe className="size-icon-xs" strokeWidth={2} />
          EN
          <ChevronDown className="size-icon-xs text-text-dim" strokeWidth={2.5} />
        </Pill>

        <button
          type="button"
          onClick={onOpenHistory}
          aria-label="Open investigation history"
          className={cn(iconBtn, 'xl:hidden')}
        >
          <Clock className="size-icon" strokeWidth={2} />
        </button>

        {/* Three explicit options rather than a binary toggle, because high
         *  contrast is a peer of light and dark, not a modifier. */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label={`Theme: ${THEME_LABELS[theme]}`} className={iconBtn}>
              <ThemeIcon className="size-icon" strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className={menuPanel}>
              {THEMES.map((t) => {
                const Icon = THEME_ICONS[t]
                return (
                  <DropdownMenu.Item key={t} onSelect={() => onThemeChange(t)} className={menuItem}>
                    <Icon className="size-icon-sm text-text-muted" strokeWidth={2} />
                    <span className="flex-1">{THEME_LABELS[t]}</span>
                    {theme === t && <Check className="size-icon-sm text-accent" strokeWidth={2.5} />}
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button type="button" aria-label="Share" className={cn(iconBtn, 'hidden sm:block')}>
          <Share2 className="size-icon" strokeWidth={2} />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label="More options" className={iconBtn}>
              <MoreHorizontal className="size-icon" strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className={menuPanel}>
              {/* Demo control. Error handling is invisible when nothing is
               *  broken, so faults are injectable on demand. */}
              <DropdownMenu.CheckboxItem
                checked={injectFaults}
                onCheckedChange={onInjectFaultsChange}
                className={menuItem}
              >
                <TriangleAlert className="size-icon-sm text-warn" strokeWidth={2} />
                <span className="flex-1">Inject faults</span>
                {injectFaults && <Check className="size-icon-sm text-accent" strokeWidth={2.5} />}
              </DropdownMenu.CheckboxItem>
              <p className="px-2.5 pb-1.5 pt-1 text-micro leading-snug text-text-dim">
                Adds an unknown widget type and a malformed payload to the next generation.
              </p>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5',
        'text-body font-medium text-text transition-colors hover:bg-surface-hover',
        className,
      )}
    >
      {children}
    </button>
  )
}
