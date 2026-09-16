import { motion } from 'framer-motion'
import {
  ArrowUp,
  Brain,
  ChevronDown,
  Globe,
  Loader2,
  Mic,
  Paperclip,
  Settings2,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

interface ComposerProps {
  onSubmit: (prompt: string) => void
  busy: boolean
}

/**
 * The prompt bar. The one piece of chrome that is fully wired, because it is
 * what drives the generative loop the assessment is actually about.
 */
export function Composer({ onSubmit, busy }: ComposerProps) {
  const [value, setValue] = useState('')

  function submit() {
    const prompt = value.trim()
    if (!prompt || busy) return
    onSubmit(prompt)
    setValue('')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center px-6"
    >
      <div
        className={cn(
          'pointer-events-auto w-full max-w-[760px] rounded-2xl border border-border',
          'bg-bg-elevated/95 p-3 shadow-float backdrop-blur-xl',
        )}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line — the convention for a
            // chat surface.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          placeholder="Type your request here..."
          aria-label="Investigation prompt"
          className={cn(
            'w-full resize-none bg-transparent px-2 py-1.5 text-sm text-text',
            'placeholder:text-text-dim focus:outline-none',
          )}
        />

        <div className="mt-1 flex items-center gap-2">
          <IconBtn label="Attach file">
            <Paperclip className="size-[18px]" strokeWidth={2} />
          </IconBtn>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-surface-hover"
          >
            Full Analysis
            <ChevronDown className="size-3.5 text-text-dim" strokeWidth={2.5} />
          </button>

          <IconBtn label="Settings">
            <Settings2 className="size-[18px]" strokeWidth={2} />
          </IconBtn>
          <IconBtn label="Model">
            <Brain className="size-[18px]" strokeWidth={2} />
          </IconBtn>

          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-surface-hover"
          >
            <Globe className="size-3.5" strokeWidth={2} />
            EN
            <ChevronDown className="size-3.5 text-text-dim" strokeWidth={2.5} />
          </button>

          <div className="flex-1" />

          <IconBtn label="Voice input">
            <Mic className="size-[18px]" strokeWidth={2} />
          </IconBtn>

          <button
            type="button"
            onClick={submit}
            disabled={busy || value.trim().length === 0}
            aria-label="Send prompt"
            className={cn(
              'flex size-9 items-center justify-center rounded-full transition-all duration-150',
              'bg-surface text-text hover:bg-surface-hover',
              'disabled:opacity-40',
              value.trim().length > 0 && !busy && 'bg-accent text-accent-fg hover:bg-accent-hover',
            )}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function IconBtn({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
    >
      {children}
    </button>
  )
}
