import { createContext, useContext, type ReactNode } from 'react'
import type { WidgetEnvelope } from '@/types/schema'

const WidgetEnvelopeContext = createContext<WidgetEnvelope | null>(null)

/**
 * Makes the raw envelope available to anything rendered inside a widget.
 *
 * Context rather than props on purpose: `WidgetCard` is rendered by each widget,
 * several levels below the renderer, and the envelope is only needed for chrome
 * concerns like the inspector. Threading it through every widget's props would
 * add a parameter to six components that none of them actually use, purely to
 * deliver it to a sibling of their own content.
 */
export function WidgetEnvelopeProvider({
  envelope,
  children,
}: {
  envelope: WidgetEnvelope
  children: ReactNode
}) {
  return (
    <WidgetEnvelopeContext.Provider value={envelope}>{children}</WidgetEnvelopeContext.Provider>
  )
}

/** Returns null outside a widget — the inspector entry simply hides. */
export function useWidgetEnvelope(): WidgetEnvelope | null {
  return useContext(WidgetEnvelopeContext)
}
