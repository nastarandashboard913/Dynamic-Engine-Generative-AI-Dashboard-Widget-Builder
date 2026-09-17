import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

type ToastTone = 'error' | 'success'

interface Toast {
  id: number
  tone: ToastTone
  title: string
  detail?: string
  /** Offered when the failed operation is safe to repeat. */
  onRetry?: () => void
  /** Dismissed, but still mounted so its exit animation can play. */
  exiting?: boolean
}

interface ToastApi {
  push: (toast: Omit<Toast, 'id'>) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const DURATION = 5000
/** Must match the `toast-out` animation in index.css. */
const EXIT_MS = 200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  // Two-phase removal: mark as exiting so the CSS animation runs, then unmount.
  // This is the one behaviour AnimatePresence provided that CSS cannot do alone —
  // an element already removed from the DOM has nothing left to animate.
  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, exiting: true } : x)))
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), EXIT_MS)
  }, [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId.current++
      setToasts((t) => [...t, { ...toast, id }])
      window.setTimeout(() => dismiss(id), DURATION)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* The brief asks for rollback notifications that are non-intrusive: this
       *  is a corner region, never a modal, and it never takes focus or blocks
       *  interaction. `aria-live="polite"` announces it without interrupting a
       *  screen reader mid-sentence. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-5 bottom-5 z-50 ml-auto flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-exiting={toast.exiting ? 'true' : undefined}
            className={cn(
              'toast pointer-events-auto flex items-start gap-3 rounded-card border bg-bg-elevated p-3.5 shadow-float',
              toast.tone === 'error' ? 'border-danger/35' : 'border-success/35',
            )}
          >
            {toast.tone === 'error' ? (
              <AlertCircle className="mt-0.5 size-icon shrink-0 text-danger" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="mt-0.5 size-icon shrink-0 text-success" strokeWidth={2} />
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">{toast.title}</p>
              {toast.detail && (
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{toast.detail}</p>
              )}
              {toast.onRetry && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onRetry?.()
                    dismiss(toast.id)
                  }}
                  className="mt-2 rounded-chip border border-border px-2.5 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
                >
                  Retry
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="rounded-md p-0.5 text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
