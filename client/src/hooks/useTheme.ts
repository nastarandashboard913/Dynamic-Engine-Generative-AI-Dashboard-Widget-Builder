import { useCallback, useEffect, useState } from 'react'

export const THEMES = ['dark', 'light', 'hc'] as const
export type Theme = (typeof THEMES)[number]

export const THEME_LABELS: Record<Theme, string> = {
  dark: 'Dark',
  light: 'Light',
  hc: 'High contrast',
}

const STORAGE_KEY = 'dynamic-engine:theme'

function readInitial(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && (THEMES as readonly string[]).includes(stored)) return stored as Theme
  return 'dark'
}

/**
 * Theme state.
 *
 * The actual switch is one attribute write on <html>; React state exists only
 * so the UI can show which theme is active. No context, no re-render cascade,
 * and crucially no component anywhere reads a colour value — they all resolve
 * through CSS custom properties, so the entire palette changes without a single
 * component re-rendering.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readInitial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])

  const cycleTheme = useCallback(() => {
    setThemeState((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length] ?? 'dark')
  }, [])

  return { theme, setTheme, cycleTheme }
}
