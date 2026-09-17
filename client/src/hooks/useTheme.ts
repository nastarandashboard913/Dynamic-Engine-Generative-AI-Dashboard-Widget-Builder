import { useSyncExternalStore } from 'react'

export const THEMES = ['dark', 'light', 'hc'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  hc: 'High contrast',
}

const STORAGE_KEY = 'dynamic-engine:theme'

/* ============================================================================
 * Theme store
 * ---------------------------------------------------------------------------
 * Theming here is done entirely with CSS custom properties, which means
 * switching themes should require EXACTLY ZERO React re-renders: the browser
 * re-resolves `var(--surface)` and repaints. Nothing in the tree reads a colour
 * from JavaScript.
 *
 * The previous implementation missed that. `useTheme()` held useState in the
 * root component, so one click re-rendered the entire workspace — the shell,
 * the grid, the DndContext and nine `useSortable` hooks — and only then, in an
 * effect, wrote the attribute that actually does the work. The measured cost
 * was an INP above 3 seconds.
 *
 * Now the attribute is written SYNCHRONOUSLY in the event handler, so the
 * repaint starts immediately rather than waiting on React. State lives in a
 * module-level store, and the only subscriber is the control that renders the
 * current theme's icon.
 * ========================================================================= */

function readInitial(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && (THEMES as readonly string[]).includes(stored)) return stored as Theme
  } catch {
    /* private mode / storage disabled */
  }
  return 'dark'
}

let current: Theme = typeof document === 'undefined' ? 'dark' : readInitial()
const listeners = new Set<() => void>()

/**
 * Applies the theme to the document immediately, then notifies subscribers.
 *
 * Order matters: the DOM write happens first so the browser can begin the style
 * recalculation in the same task as the click, independent of whatever React
 * does afterwards.
 */
export function setTheme(next: Theme): void {
  if (next === current) return
  current = next

  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* non-fatal: the theme still applies for this session */
  }

  for (const fn of listeners) fn()
}

/**
 * Applies a theme declared by the payload.
 *
 * Deliberately deferential: if the user has ever picked a theme themselves,
 * that choice wins and this is a no-op. It also does NOT persist, so the
 * server's preference stays a default rather than quietly becoming the user's
 * saved setting.
 */
export function applyServerTheme(next: Theme): void {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return
  } catch {
    return
  }
  if (next === current) return
  current = next
  document.documentElement.dataset.theme = next
  for (const fn of listeners) fn()
}

export function cycleTheme(): void {
  setTheme(THEMES[(THEMES.indexOf(current) + 1) % THEMES.length] ?? 'dark')
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot(): Theme {
  return current
}

/**
 * Subscribes to the active theme.
 *
 * Call this ONLY where the current theme is actually rendered — today that is
 * the theme switcher's icon and checkmarks. Calling it higher in the tree would
 * reintroduce the cascade this store exists to remove.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
