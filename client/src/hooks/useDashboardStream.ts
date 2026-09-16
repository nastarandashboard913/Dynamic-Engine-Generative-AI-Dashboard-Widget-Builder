import { useCallback, useEffect, useRef, useState } from 'react'
import {
  dashboardMetaSchema,
  widgetEnvelopeSchema,
  type DashboardMeta,
  type Placeholder,
  type WidgetEnvelope,
} from '@/types/schema'

export type StreamStatus = 'idle' | 'streaming' | 'complete' | 'error'

interface StreamState {
  status: StreamStatus
  meta: DashboardMeta | null
  /** Render order and reserved geometry, known from the first event. */
  placeholders: Placeholder[]
  /** Arrived widgets, keyed by id. Absent id ⇒ still a skeleton. */
  widgets: Map<string, WidgetEnvelope>
  error: string | null
}

const INITIAL: StreamState = {
  status: 'idle',
  meta: null,
  placeholders: [],
  widgets: new Map(),
  error: null,
}

/**
 * Consumes the dashboard SSE stream.
 *
 * `EventSource` only issues GET requests, and the endpoint is a POST carrying a
 * prompt, so the stream is read off the fetch body reader and the SSE framing is
 * parsed by hand. That is a small amount of code in exchange for keeping the
 * request shape honest.
 *
 * The state split is what delivers zero CLS: `placeholders` (full geometry,
 * available immediately) is separate from `widgets` (content, arriving over
 * time). The grid renders from `placeholders` on the very first event, so the
 * page reaches its final layout before any widget data exists.
 */
export function useDashboardStream() {
  const [state, setState] = useState<StreamState>(INITIAL)
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (prompt: string, injectFaults = false) => {
    // A new prompt supersedes whatever is in flight.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ ...INITIAL, status: 'streaming', widgets: new Map() })

    try {
      const res = await fetch('/api/generate-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, injectFaults }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error(`Stream failed (${res.status})`)
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      // Chunk boundaries fall wherever the network puts them, so a partial event
      // must survive between reads.
      let buffer = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += value

        // SSE events are separated by a blank line.
        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          handleEvent(raw, setState)
          boundary = buffer.indexOf('\n\n')
        }
      }

      setState((s) => (s.status === 'streaming' ? { ...s, status: 'complete' } : s))
    } catch (error) {
      // An abort is a supersede, not a failure — leave state to the new run.
      if (controller.signal.aborted) return
      setState((s) => ({
        ...s,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown streaming error',
      }))
    }
  }, [])

  // Abort in flight work on unmount so a dropped stream cannot setState on a
  // dead component.
  useEffect(() => () => abortRef.current?.abort(), [])

  return { ...state, generate }
}

function handleEvent(raw: string, setState: React.Dispatch<React.SetStateAction<StreamState>>) {
  let event = 'message'
  let data = ''

  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }

  if (!data) return

  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    console.warn('[stream] unparseable event payload', raw.slice(0, 120))
    return
  }

  if (event === 'meta') {
    const result = dashboardMetaSchema.safeParse(parsed)
    if (!result.success) {
      console.warn('[stream] invalid meta', result.error.issues)
      return
    }
    setState((s) => ({
      ...s,
      meta: result.data,
      placeholders: result.data.placeholders,
    }))
    return
  }

  if (event === 'widget') {
    const result = widgetEnvelopeSchema.safeParse(parsed)
    if (!result.success) {
      // The ENVELOPE is malformed — not the payload. There is no id to attach a
      // fallback to, so the placeholder simply stays a skeleton.
      console.warn('[stream] invalid widget envelope', result.error.issues)
      return
    }
    setState((s) => {
      // New Map identity so React sees the change; entries are shared by
      // reference so already-rendered widgets keep referential equality and
      // stay memoised.
      const widgets = new Map(s.widgets)
      widgets.set(result.data.id, result.data)
      return { ...s, widgets }
    })
    return
  }

  if (event === 'done') {
    setState((s) => ({ ...s, status: 'complete' }))
  }
}
