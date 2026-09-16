import { MotionConfig } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { Composer } from '@/features/shell/Composer'
import { HistoryPanel } from '@/features/shell/HistoryPanel'
import { Sidebar } from '@/features/shell/Sidebar'
import { TopBar } from '@/features/shell/TopBar'
import { useDashboardStream } from '@/hooks/useDashboardStream'
import { ToastProvider } from '@/hooks/useToast'
import { useTheme } from '@/hooks/useTheme'

const SIDEBAR_ITEMS = [
  'How many active customer...',
  'High Risk Accounts Review',
  'Customer Risk Distribution',
  'Top Customers Analysis',
  'Fraud Risk Monitoring',
  'Geographic Risk Exposure',
]

const DEFAULT_PROMPT = 'Which accounts are high-risk and need review?'

function Workspace() {
  const { theme, setTheme } = useTheme()
  const [injectFaults, setInjectFaults] = useState(false)
  const stream = useDashboardStream()
  const { generate } = stream

  const run = useCallback(
    (prompt: string) => void generate(prompt, injectFaults),
    [generate, injectFaults],
  )

  // Generate once on mount so the workspace is populated on arrival.
  useEffect(() => {
    void generate(DEFAULT_PROMPT, false)
  }, [generate])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        investigations={SIDEBAR_ITEMS}
        activeInvestigation="High Risk Accounts Review"
        onSelect={run}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          breadcrumb={stream.meta?.breadcrumb ?? ['Investigation', 'High Risk Accounts Review']}
          theme={theme}
          onThemeChange={setTheme}
          injectFaults={injectFaults}
          onInjectFaultsChange={setInjectFaults}
        />

        {/* The canvas is its own scroll container so the shell stays fixed and
         *  the page body never scrolls — which is also what keeps `overflow-x:
         *  clip` on body from creating a horizontal scroll leak. */}
        <main className="relative min-h-0 flex-1 px-6 pb-6">
          <div className="relative h-full overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-bg/40 px-6 py-6">
            <Dashboard stream={stream} />
            {/* Breathing room so the floating composer never covers content. */}
            <div className="h-28" />
          </div>

          <Composer onSubmit={run} busy={stream.status === 'streaming'} />
        </main>
      </div>

      <HistoryPanel activeId={null} onSelect={run} />
    </div>
  )
}

export default function App() {
  return (
    /**
     * `reducedMotion="user"` is not optional polish.
     *
     * The CSS `prefers-reduced-motion` block in index.css only neutralises CSS
     * transitions and animations. Framer Motion drives its animations from
     * JavaScript by writing inline styles frame by frame, so it never sees that
     * rule — without this, a user who has asked the OS for reduced motion still
     * receives every spring, fade and layout animation in the app.
     *
     * Setting it here makes Framer read the media query itself and collapse
     * transform/opacity animations to instant state changes, app-wide.
     */
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Workspace />
      </ToastProvider>
    </MotionConfig>
  )
}
