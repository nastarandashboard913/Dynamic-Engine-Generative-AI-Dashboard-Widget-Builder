import * as Dialog from '@radix-ui/react-dialog'
import { Check, Copy, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { isKnownWidget } from './registry'
import type { WidgetEnvelope } from '@/types/schema'

interface WidgetInspectorProps {
  envelope: WidgetEnvelope
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Shows the exact schema object the model emitted for one widget.
 *
 * In a generative UI the payload IS the interface, so being able to read it is a
 * real affordance rather than a debug panel — it answers "why did I get this
 * card?" directly.
 *
 * Radix Dialog handles focus trapping, focus restoration on close, Escape, and
 * `aria-modal`. Hand-rolling those is where accessible modals usually go wrong.
 */
export function WidgetInspector({ envelope, open, onOpenChange }: WidgetInspectorProps) {
  const [copied, setCopied] = useState(false)

  const json = useMemo(() => JSON.stringify(envelope, null, 2), [envelope])
  const known = isKnownWidget(envelope.type)

  // Reset the copied affordance when the dialog is dismissed, so reopening it
  // does not show a stale tick.
  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  async function copy() {
    try {
      await navigator.clipboard.writeText(json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard is unavailable over plain HTTP on some hosts; failing to copy
      // is not worth an error state.
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay-anim fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" />

        <Dialog.Content
          className={cn(
            'dialog-anim fixed left-1/2 top-1/2 z-50 w-[min(640px,calc(100vw-2rem))]',
            'max-h-[min(80vh,720px)] -translate-x-1/2 -translate-y-1/2',
            'flex flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-float',
          )}
        >
          <header className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-[15px] font-semibold tracking-tight">
                {envelope.title ?? 'Widget schema'}
              </Dialog.Title>
              <Dialog.Description className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono text-[11px]',
                    known ? 'bg-accent-soft text-accent' : 'bg-warn-soft text-warn',
                  )}
                >
                  {envelope.type}
                </span>
                <span>·</span>
                <span className="numeric">span {envelope.layout.span}/12</span>
                <span>·</span>
                <span className="numeric">{envelope.layout.minHeight}px reserved</span>
                {!known && <span className="text-warn">· no registered renderer</span>}
              </Dialog.Description>
            </div>

            <button
              type="button"
              onClick={copy}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-chip border border-border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover"
            >
              {copied ? (
                <Check className="size-3.5 text-success" strokeWidth={2.5} />
              ) : (
                <Copy className="size-3.5" strokeWidth={2} />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="shrink-0 rounded-md p-1 text-text-dim transition-colors hover:bg-surface-hover hover:text-text"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </Dialog.Close>
          </header>

          <pre className="min-h-0 flex-1 overflow-auto bg-surface-sunken px-5 py-4 font-mono text-[12px] leading-relaxed text-text-muted">
            {json}
          </pre>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
