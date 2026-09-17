import { Suspense, memo, useMemo } from 'react'
import { measureSync } from '@/lib/perf'
import type { WidgetEnvelope } from '@/types/schema'
import { FallbackWidget } from './FallbackWidget'
import { WidgetEnvelopeProvider } from './WidgetContext'
import { WidgetErrorBoundary } from './WidgetErrorBoundary'
import { WidgetSkeleton } from './WidgetSkeleton'
import { resolveWidget } from './registry'

interface WidgetRendererProps {
  envelope: WidgetEnvelope
}

/**
 * Resolves one envelope to one rendered widget.
 *
 * The pipeline has four gates, each with its own failure mode, and a widget
 * must clear all four to render:
 *
 *   1. RESOLVE   registry lookup      → unknown-type fallback
 *   2. VALIDATE  zod safeParse        → invalid-payload fallback
 *   3. LOAD      lazy chunk + Suspense → skeleton (not a spinner)
 *   4. RENDER    error boundary        → render-error fallback
 *
 * Gates 1 and 2 are ordinary control flow rather than thrown errors. An unknown
 * archetype is an expected event in an LLM-driven UI — the model's vocabulary
 * will outrun the client's — so it is handled as data, not as an exception.
 */
function WidgetRendererImpl({ envelope }: WidgetRendererProps) {
  const { id, type, title, subtitle, layout, data } = envelope

  const entry = resolveWidget(type)

  // Parsing is memoised on identity: re-running zod over a 5,000-row table on
  // every parent render is exactly the kind of cost that makes streaming UIs
  // feel slow.
  const parsed = useMemo(() => {
    if (!entry) return null
    // Timed because this is the one genuinely expensive synchronous step in the
    // render path — the table's payload is ~5,000 rows — and no browser metric
    // attributes it to us specifically.
    const rowCount = Array.isArray((data as { rows?: unknown[] })?.rows)
      ? (data as { rows: unknown[] }).rows.length
      : undefined
    return measureSync(`validate ${type}`, rowCount, () => entry.schema.safeParse(data))
  }, [entry, data, type])

  if (!entry) {
    return (
      <WidgetEnvelopeProvider envelope={envelope}>
        <FallbackWidget title={title} reason={{ kind: 'unknown-type', type }} />
      </WidgetEnvelopeProvider>
    )
  }

  if (parsed && !parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    )
    return (
      // Deliberately inspectable: a rejected payload is exactly the case where
      // being able to read the raw schema explains the failure.
      <WidgetEnvelopeProvider envelope={envelope}>
        <FallbackWidget title={title} reason={{ kind: 'invalid-payload', type, issues }} />
      </WidgetEnvelopeProvider>
    )
  }

  const { Component } = entry

  return (
    <WidgetEnvelopeProvider envelope={envelope}>
      <WidgetErrorBoundary type={type} title={title} resetKey={id}>
        {/* The Suspense fallback is the SAME skeleton the streaming grid shows,
         *  at the same reserved height. Chunk-loading is therefore visually
         *  indistinguishable from waiting for data, and neither shifts layout. */}
        <Suspense
          fallback={<WidgetSkeleton type={type} title={title} minHeight={layout.minHeight} />}
        >
          <Component id={id} title={title} subtitle={subtitle} data={parsed?.data} />
        </Suspense>
      </WidgetErrorBoundary>
    </WidgetEnvelopeProvider>
  )
}

/**
 * Memoised on the envelope reference. During a stream, appending widget N
 * re-renders the grid; without this every already-rendered widget would
 * re-render too — including the virtualised table.
 */
export const WidgetRenderer = memo(WidgetRendererImpl)
