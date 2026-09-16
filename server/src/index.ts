/* ============================================================================
 * Dynamic Engine — mock LLM server
 * ---------------------------------------------------------------------------
 * POST /api/generate-dashboard   SSE stream of widget configurations
 * POST /api/widget-action        mutates widget state; fails on purpose
 * GET  /api/investigations       history list
 * POST /api/investigations       create
 * DELETE /api/investigations/:id remove
 * ========================================================================= */

import cors from 'cors'
import express from 'express'
import { investigations, widgetState } from './db.ts'
import { planDashboard } from './generator.ts'

const app = express()
const PORT = Number(process.env.PORT ?? 8787)

/** Share of /api/widget-action calls that fail, so optimistic rollback is
 *  observable without hand-editing code. Override with FAIL_RATE=0 for a clean
 *  demo, or FAIL_RATE=1 to show the rollback path every time. */
const FAIL_RATE = Number(process.env.FAIL_RATE ?? 0.2)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, failRate: FAIL_RATE })
})

/* --------------------------------------------------------------------------
 * Dashboard stream
 *
 * Event order matters and is the whole CLS strategy:
 *
 *   1. `meta`    — includes a placeholder for EVERY widget (id, type, span,
 *                  minHeight) before any data exists. The client can lay out
 *                  the entire grid and reserve exact boxes immediately.
 *   2. `widget`  — one per widget, filling a box that is already on screen.
 *   3. `done`    — stream complete.
 *
 * Because step 1 fixes the geometry, steps 2..n swap skeleton for content
 * inside a box whose size never changes. Nothing below ever shifts.
 * ----------------------------------------------------------------------- */
app.post('/api/generate-dashboard', async (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim() || 'Show me high-risk accounts'
  const injectFaults = Boolean(req.body?.injectFaults)

  const { meta, widgets } = planDashboard({ prompt, injectFaults })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stops nginx-style proxies buffering the stream into one blob.
    'X-Accel-Buffering': 'no',
  })

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // NOTE: must be res.on('close'), not req.on('close'). On a POST whose body
  // express.json() has already consumed, the request stream emits 'close' as
  // soon as the body is read — which would abort the loop immediately. The
  // response stream is the only reliable client-disconnect signal here.
  let closed = false
  res.on('close', () => {
    closed = true
  })

  send('meta', {
    ...meta,
    placeholders: widgets.map((w) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      layout: w.layout,
    })),
  })

  for (const widget of widgets) {
    if (closed) return
    // Uneven delays: a real model emits a small card faster than a 5k-row table.
    await sleep(widget.layout.span >= 12 ? 420 : 180)
    if (closed) return
    send('widget', widget)
  }

  send('done', { widgetCount: widgets.length })
  res.end()
})

/* --------------------------------------------------------------------------
 * Widget action — the endpoint optimistic updates roll back against.
 * ----------------------------------------------------------------------- */
app.post('/api/widget-action', async (req, res) => {
  const { widgetId, action, payload, forceFail } = req.body ?? {}

  if (typeof widgetId !== 'string' || typeof action !== 'string') {
    res.status(400).json({ ok: false, error: 'widgetId and action are required' })
    return
  }

  // Latency the optimistic UI is designed to hide.
  await sleep(350 + Math.random() * 550)

  const shouldFail = forceFail === true || Math.random() < FAIL_RATE
  if (shouldFail) {
    res.status(503).json({
      ok: false,
      error: 'Upstream agent rejected the update. Please retry.',
    })
    return
  }

  const prev = widgetState.get(widgetId) ?? {}
  const next = { ...prev, ...(payload as Record<string, unknown> | undefined) }
  widgetState.set(widgetId, next)

  res.json({ ok: true, widgetId, action, state: next, updatedAt: Date.now() })
})

/* --------------------------------------------------------------------------
 * Investigation history CRUD
 * ----------------------------------------------------------------------- */
app.get('/api/investigations', (_req, res) => {
  res.json({ items: [...investigations].sort((a, b) => b.createdAt - a.createdAt) })
})

app.post('/api/investigations', (req, res) => {
  const prompt = String(req.body?.prompt ?? '').trim()
  if (!prompt) {
    res.status(400).json({ ok: false, error: 'prompt is required' })
    return
  }
  const item = { id: `inv_${Date.now().toString(36)}`, prompt, createdAt: Date.now() }
  investigations.unshift(item)
  res.status(201).json(item)
})

app.delete('/api/investigations/:id', (req, res) => {
  const i = investigations.findIndex((x) => x.id === req.params.id)
  if (i === -1) {
    res.status(404).json({ ok: false, error: 'not found' })
    return
  }
  const [removed] = investigations.splice(i, 1)
  res.json({ ok: true, removed })
})

app.listen(PORT, () => {
  console.log(`  ▸ Dynamic Engine server  http://localhost:${PORT}`)
  console.log(`  ▸ widget-action fail rate ${(FAIL_RATE * 100).toFixed(0)}%`)
})
