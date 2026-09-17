import { MotionConfig } from 'framer-motion'
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Dashboard } from '@/features/dashboard/Dashboard'

import { Composer } from '@/features/shell/Composer'
import { HistoryPanel } from '@/features/shell/HistoryPanel'
import { Sidebar } from '@/features/shell/Sidebar'
import { TopBar } from '@/features/shell/TopBar'
import { useDashboardStream } from '@/hooks/useDashboardStream'
import { applyServerTheme } from '@/hooks/useTheme'
import { ToastProvider } from '@/hooks/useToast'

const SIDEBAR_ITEMS = [
  'How many active customer...',
  'High Risk Accounts Review',
  'Customer Risk Distribution',
  'Top Customers Analysis',
  'Fraud Risk Monitoring',
  'Geographic Risk Exposure',
]

const DEFAULT_PROMPT = 'Which accounts are high-risk and need review?'

/**
 * Lazy so the diagnostics panel costs nothing until it is opened. A statically
 * imported dev tool sits in the entry chunk of every session that never uses it.
 */
const PerfOverlay = lazy(() =>
  import('@/features/devtools/PerfOverlay').then((m) => ({ default: m.PerfOverlay })),
)

function Workspace() {
  const [injectFaults, setInjectFaults] = useState(false)
  // The only state the responsive shell needs. Both panels are STATIC at their
  // respective breakpoints — these flags matter solely below them, where the
  // panel becomes an overlay drawer.
  const [navOpen, setNavOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [showPerf, setShowPerf] = useState(false)

  // The control that opened the current drawer. Without this, closing a drawer
  // drops focus to <body> and the next Tab restarts from the top of the page —
  // the keyboard equivalent of being teleported somewhere you did not ask to go.
  const drawerTrigger = useRef<HTMLElement | null>(null)

  const stream = useDashboardStream()
  const { generate } = stream

  const openDrawer = useCallback((which: 'nav' | 'history') => {
    drawerTrigger.current = document.activeElement as HTMLElement | null
    if (which === 'nav') setNavOpen(true)
    else setHistoryOpen(true)
  }, [])

  const closePanels = useCallback(() => {
    setNavOpen(false)
    setHistoryOpen(false)
    // Hand focus back to the trigger so the keyboard position is preserved.
    drawerTrigger.current?.focus()
    drawerTrigger.current = null
  }, [])

  const run = useCallback(
    (prompt: string) => {
      // Selecting from a drawer should dismiss it, otherwise the result is
      // hidden behind the thing that produced it.
      closePanels()
      void generate(prompt, injectFaults)
    },
    [generate, injectFaults, closePanels],
  )

  useEffect(() => {
    void generate(DEFAULT_PROMPT, false)
  }, [generate])

  // The payload declares a theme. Honour it unless the user has chosen one.
  const streamTheme = stream.meta?.theme
  useEffect(() => {
    if (streamTheme) applyServerTheme(streamTheme)
  }, [streamTheme])

  // Escape closes whichever drawer is open — expected of any overlay.
  useEffect(() => {
    if (!navOpen && !historyOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanels()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen, historyOpen, closePanels])

  const drawerOpen = navOpen || historyOpen

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* First focusable element on the page. The sidebar holds ~15 links, and
       *  without this a keyboard user tabs through every one of them before
       *  reaching the dashboard — on every single load. Hidden until focused. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-chip focus:border focus:border-border focus:bg-bg-elevated focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-text focus:shadow-float"
      >
        Skip to main content
      </a>

      <Sidebar
        investigations={SIDEBAR_ITEMS}
        activeInvestigation="High Risk Accounts Review"
        onSelect={run}
        open={navOpen}
        onClose={closePanels}
      />

      {/* Shared scrim. Hidden from xl up, where neither panel can be a drawer. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close panel"
          onClick={closePanels}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-xs xl:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          breadcrumb={stream.meta?.breadcrumb ?? ['Investigation', 'High Risk Accounts Review']}
          injectFaults={injectFaults}
          onInjectFaultsChange={setInjectFaults}
          onOpenNav={() => openDrawer('nav')}
          onOpenHistory={() => openDrawer('history')}
          showPerf={showPerf}
          onShowPerfChange={setShowPerf}
        />

        {/* The canvas is its own scroll container so the shell stays fixed and
         *  the page body never scrolls — which is also what keeps
         *  `overflow-x: clip` on body from creating a horizontal scroll leak. */}
        <main
          id="main"
          // -1 makes it programmatically focusable (for the skip link) without
          // adding it to the natural tab order.
          tabIndex={-1}
          className="relative min-h-0 flex-1 px-3 pb-3 focus:outline-none sm:px-6 sm:pb-6"
        >
          {/* The dashboard assembles itself over ~2s. A sighted user watches it
           *  happen; without this a screen-reader user gets silence. Announced
           *  on completion only — one message per generation, not one per
           *  widget, which would be unusable chatter. */}
          <p aria-live="polite" className="sr-only">
            {stream.status === 'streaming'
              ? 'Generating dashboard'
              : stream.status === 'complete'
                ? `Dashboard ready with ${stream.placeholders.length} widgets`
                : stream.status === 'error'
                  ? 'Dashboard generation failed'
                  : ''}
          </p>
          <div className="relative h-full overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-bg/40 px-3 py-4 sm:px-6 sm:py-6">
            {/* Caps line length on very wide displays; below the cap this is a
             *  no-op, so it costs nothing at normal sizes. */}
            <div className="mx-auto w-full max-w-canvas">
              <Dashboard stream={stream} />
              {/* Breathing room so the floating composer never covers content. */}
              <div className="h-28" />
            </div>
          </div>

          <Composer onSubmit={run} busy={stream.status === 'streaming'} />
        </main>
      </div>

      <HistoryPanel
        activeId={null}
        onSelect={run}
        open={historyOpen}
        onClose={closePanels}
      />

      {showPerf && (
        // No fallback: a loading placeholder for a diagnostics panel would be
        // noise, and the chunk is ~2kB.
        <Suspense fallback={null}>
          <PerfOverlay onClose={() => setShowPerf(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  return (
    /**
     * `reducedMotion="user"` is not optional polish.
     *
     * The CSS `prefers-reduced-motion` block in index.css only neutralises CSS
     * transitions. Framer Motion drives its animations from JavaScript by
     * writing inline styles frame by frame, so it never sees that rule —
     * without this, a user who has asked the OS for reduced motion still
     * receives every spring, fade and layout animation in the app.
     */
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Workspace />
      </ToastProvider>
    </MotionConfig>
  )
}
