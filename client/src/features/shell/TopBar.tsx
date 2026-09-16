import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Check,
  ChevronDown,
  Contrast,
  Globe,
  Moon,
  MoreHorizontal,
  Share2,
  Sun,
  TriangleAlert,
} from 'lucide-react'
import { THEMES, THEME_LABELS, type Theme } from '@/hooks/useTheme'
import { cn } from '@/lib/cn'

interface TopBarProps {
  breadcrumb: string[]
  theme: Theme
  onThemeChange: (t: Theme) => void
  injectFaults: boolean
  onInjectFaultsChange: (v: boolean) => void
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
  'pop-anim z-50 min-w-[190px] rounded-xl border border-border bg-bg-elevated p-1.5 shadow-float',
)
const menuItem = cn(
  'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none',
  'transition-colors data-[highlighted]:bg-surface-hover',
)

export function TopBar({
  breadcrumb,
  theme,
  onThemeChange,
  injectFaults,
  onInjectFaultsChange,
}: TopBarProps) {
  const ThemeIcon = THEME_ICONS[theme]

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        {breadcrumb.map((crumb, i) => {
          const last = i === breadcrumb.length - 1
          return (
            <span key={crumb} className="flex min-w-0 items-center gap-2">
              <span className={cn('truncate', last ? 'font-medium text-text' : 'text-text-muted')}>
                {crumb}
              </span>
              {!last && <span className="text-text-dim">/</span>}
            </span>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <Pill>
          <span className="size-1.5 rounded-full bg-success" />
          neonDB
          <ChevronDown className="size-3.5 text-text-dim" strokeWidth={2.5} />
        </Pill>

        <Pill>
          <Globe className="size-3.5" strokeWidth={2} />
          EN
          <ChevronDown className="size-3.5 text-text-dim" strokeWidth={2.5} />
        </Pill>

        {/* Theme switcher — three explicit options rather than a binary toggle,
         *  because high contrast is a peer of light and dark, not a modifier. */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`Theme: ${THEME_LABELS[theme]}`}
              className={iconBtn}
            >
              <ThemeIcon className="size-[18px]" strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className={menuPanel}>
              {THEMES.map((t) => {
                const Icon = THEME_ICONS[t]
                return (
                  <DropdownMenu.Item
                    key={t}
                    onSelect={() => onThemeChange(t)}
                    className={menuItem}
                  >
                    <Icon className="size-4 text-text-muted" strokeWidth={2} />
                    <span className="flex-1">{THEME_LABELS[t]}</span>
                    {theme === t && <Check className="size-4 text-accent" strokeWidth={2.5} />}
                  </DropdownMenu.Item>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button type="button" aria-label="Share" className={iconBtn}>
          <Share2 className="size-[18px]" strokeWidth={2} />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label="More options" className={iconBtn}>
              <MoreHorizontal className="size-[18px]" strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={8} className={menuPanel}>
              {/* Demo control. Error handling is invisible when nothing is
               *  broken, so faults are injectable on demand rather than left to
               *  chance or to a code edit. */}
              <DropdownMenu.CheckboxItem
                checked={injectFaults}
                onCheckedChange={onInjectFaultsChange}
                className={menuItem}
              >
                <TriangleAlert className="size-4 text-warn" strokeWidth={2} />
                <span className="flex-1">Inject faults</span>
                {injectFaults && <Check className="size-4 text-accent" strokeWidth={2.5} />}
              </DropdownMenu.CheckboxItem>
              <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-snug text-text-dim">
                Adds an unknown widget type and a malformed payload to the next
                generation.
              </p>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}

const iconBtn = cn(
  'rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text',
)

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5',
        'text-[13px] font-medium text-text transition-colors hover:bg-surface-hover',
      )}
    >
      {children}
    </button>
  )
}
