# Dynamic Engine

**Generative AI Dashboard & Widget Builder** — an adaptive workspace that renders a
live BI dashboard from widget schemas streamed by an LLM backend.

The frontend does not know what the dashboard looks like. It receives a stream of
widget descriptors, resolves each one to a React component at runtime, and renders
whatever arrives — including archetypes it has never seen, which degrade to an
explained fallback instead of taking down the page.

---

## Quick start

### Option A — Docker (recommended)

Requires Docker Desktop or any Docker engine with Compose v2.

```bash
docker compose up --build
```

| Service | URL |
|---|---|
| Client (nginx, production build) | http://localhost:5173 |
| API (direct, for curl/Postman) | http://localhost:8787 |

The client container proxies `/api/*` to the server over the Compose network, so
the browser only ever talks to one origin — no CORS, and no preflight on the
streaming endpoint.

```bash
docker compose down -v      # stop and clean up
```

### Option B — Local Node

Requires Node 20+ (developed on Node 23).

```bash
npm install      # root tooling (concurrently)
npm run setup    # installs client + server dependencies
npm run dev      # runs both, colour-tagged in one terminal
```

Client on http://localhost:5173 with HMR, API on http://localhost:8787. Vite
proxies `/api`, so client code uses relative URLs and behaves identically in both
modes.

### Verify it is working

```bash
curl localhost:8787/api/health

# watch the dashboard stream arrive widget by widget
curl -N -X POST localhost:8787/api/generate-dashboard \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Show me high-risk accounts"}'
```

---

## Scripts

Run from the repository root.

| Command | Does |
|---|---|
| `npm run setup` | installs client + server dependencies |
| `npm run dev` | runs both services, colour-tagged in one terminal |
| `npm run dev:server` / `npm run dev:client` | run one half only |
| `npm run build` | production build of the client |
| `npm run typecheck` | `tsc -b` across both packages |
| `npm run docker:up` / `npm run docker:down` | Compose up / tear down |
| `npm run perf` | LCP, CLS, long tasks and theme-switch cost, at two viewports |
| `npm run smoke` | 19 functional checks against the running stack |
| `npm run a11y` | 10 keyboard and screen-reader checks |

The last two drive headless Chromium via Playwright and expect the stack to be
running. Playwright has no postinstall step, so `npm run setup` does not
download a browser; run `npx playwright install chromium` inside `client/` the
first time you use them.

---

## Project structure

```
.
├── docker-compose.yml          # both services, healthcheck-gated startup
├── package.json                # root scripts only (no workspace hoisting)
│
├── server/                     # mock LLM backend — Express + TypeScript
│   ├── Dockerfile
│   └── src/
│       ├── index.ts            # routes, SSE stream, action endpoint
│       ├── generator.ts        # prompt → widget plan (the "LLM")
│       ├── db.ts               # seeded in-memory dataset (~5,000 accounts)
│       └── types.ts            # the widget contract
│
└── client/                     # React 19 + TypeScript + Tailwind v4
    ├── Dockerfile
    ├── nginx.conf              # SPA fallback + SSE-safe API proxy
    ├── scripts/                # perf + smoke measurement (Playwright)
    └── src/
        ├── types/schema.ts     # zod schemas — every payload is validated here
        ├── styles/tokens.css   # design tokens, three themes
        ├── lib/                # api client, cn helper, perf instrumentation
        ├── hooks/              # stream, optimistic state, theme, toasts
        ├── components/         # WidgetCard, Sparkline
        └── features/
            ├── registry/       # ◄ the core: resolver, boundary, skeletons
            ├── widgets/        # six archetype renderers
            ├── layout/         # grid matrix + drag-and-drop
            ├── shell/          # sidebar, top bar, history, composer
            ├── devtools/       # live performance overlay
            └── dashboard/      # stream ↔ grid orchestration
```

The two halves keep **separate** `package.json` files rather than a workspace.
Each is independently installable and dockerisable, which is what the brief asks
for and what makes Compose layer caching work.

---

## Architecture

### The widget contract

Every widget on the wire is the same envelope, discriminated by `type`:

```jsonc
{
  "id": "wgt_metric_1",
  "type": "METRIC_CARD",
  "title": "High Risk",
  "layout": { "span": 3, "minHeight": 124 },  // 12-col units, reserved px
  "data": { /* archetype-specific */ }
}
```

Two details carry most of the design weight:

**`type` is typed as `string`, not a union of known archetypes.** A real model will
eventually emit something the client has never heard of. Typing this as a closed
union would make that case unrepresentable at compile time while it remains
entirely possible at runtime — hiding the exact failure the brief asks us to
handle.

**`layout` travels with the widget, not with the client.** The server declares how
much room a widget needs; the client does not guess. This is what makes zero-CLS
streaming possible.

### Dynamic Component Registry

`client/src/features/registry/` — the single place where a wire-format string
becomes a React component.

Each archetype is **one registry entry** binding a label, a zod schema, and a
lazily-imported component:

```ts
METRIC_CARD: {
  label: 'Metric Card',
  schema: metricCardSchema,
  Component: lazy(() => import('../widgets/MetricCard')…),
}
```

Adding an archetype requires no changes to the renderer, the grid, or the stream
handler. Three properties are deliberate:

1. **Schema and component are bound together.** A component is only reachable
   through its own validator, so no widget can render unvalidated data. The
   schema is not a separate step a contributor can forget.
2. **Every component is lazy.** Each archetype is its own chunk — a dashboard of
   four metric cards never downloads the table or the form runtime.
3. **The client re-validates everything.** The server and client both describe
   the contract, and that duplication is intentional. A shared type package gives
   compile-time agreement and zero runtime protection, and these payloads
   originate from a language model — the one source that will confidently emit a
   shape that type-checks nowhere.

#### The four gates

`WidgetRenderer` puts every envelope through four gates, each with its own
failure mode:

| Gate | Mechanism | On failure |
|---|---|---|
| 1. Resolve | registry lookup | `unknown-type` fallback |
| 2. Validate | `schema.safeParse` | `invalid-payload` fallback, with issues listed in dev |
| 3. Load | `React.lazy` + Suspense | the widget's skeleton, at its reserved height |
| 4. Render | error boundary | `render-error` fallback, with retry |

Gates 1 and 2 are ordinary control flow, not thrown errors. An unknown archetype
is an *expected* event in an LLM-driven UI — the model's vocabulary will outrun
the client's — so it is handled as data.

**Error boundaries are per widget, not per grid.** A single boundary around the
workspace would satisfy "does not crash" while still blanking the entire page
when one widget throws. Scoped per widget, a failure costs exactly one card.

Boundaries reset on `resetKey` change; without that, a widget that failed once
would stay failed even after a good payload replaced it.

#### Supported archetypes

| Type | Renders |
|---|---|
| `NARRATIVE_HEADER` | generated headline, summary, provenance chips |
| `METRIC_CARD` | KPI value, trend, hand-rolled SVG sparkline |
| `DATA_TABLE` | sortable, filterable, virtualised (~5,000 rows) |
| `CHECKLIST` | optimistic toggles with rollback |
| `DISTRIBUTION_CHART` | histogram with hover readout |
| `DYNAMIC_FORM` | schema-driven fields *and* validation rules |

### Card composition

`WidgetCard` is a **compound component**: the caller composes the chrome rather
than configuring it.

```tsx
<WidgetCard>
  <WidgetCard.Header>
    <WidgetCard.Label>{title}</WidgetCard.Label>   {/* KPI treatment */}
    <WidgetCard.Actions>
      <WidgetCard.Verified />
      <WidgetCard.Menu />
    </WidgetCard.Actions>
  </WidgetCard.Header>
  <WidgetCard.Body className="justify-between">…</WidgetCard.Body>
</WidgetCard>
```

It began as a single component taking `title`, `subtitle`, `actions`, `verified`,
`className` and `bodyClassName`. Three of those existed only so callers could
reach *past* the component into its internals — a boolean to switch chrome off,
a second `className` to restyle the body, a `ReactNode` prop to smuggle markup
into a slot.

The failure that motivated the change: `MetricCard` needs a small uppercase label
rather than an `<h3>`, and the header's markup was unreachable. Its only option
was to pass `verified={false}`, omit `title`, and rebuild a header inside the
body — which silently cost it the inspector menu, since the menu lives in the
header. **A capability was lost to a layout mismatch.** With `Header`, `Title`
and `Label` as separate parts, it now picks the treatment it needs and keeps the
menu.

The parts share state through context, which is what makes this compound rather
than a set of namespaced divs: `<Title>` and `<Label>` register themselves as the
card's accessible name, and the root wires `aria-labelledby` to whichever one was
actually rendered — never to a label that does not exist. Rendering a part
outside `<WidgetCard>` throws a named error rather than failing silently.

### Streaming and layout-shift prevention

`POST /api/generate-dashboard` is an SSE stream, and **event order is the entire
CLS strategy**:

```
1. event: meta      → a placeholder for EVERY widget
                      (id, type, span, minHeight) before any data exists
2. event: widget    → one per widget, filling a box already on screen
3. event: done
```

Because the first event carries the complete geometry, the grid renders every
correctly-sized skeleton immediately. Each subsequent event swaps a skeleton for
content **inside a box whose dimensions never change**. Nothing below the fold is
ever pushed down.

Measured through the nginx proxy:

```
  +      0ms  meta    9 boxes reserved
  +    413ms  widget  NARRATIVE_HEADER     span=12
  +    600ms  widget  METRIC_CARD          span=3
  ...
  +   2167ms  done    { widgetCount: 9 }
```

Two supporting details:

- **Skeletons are type-aware** ("skeleton drivers"). A single grey rectangle
  reserves the right space but still jolts when real content lands, because the
  internal rhythm changes. Matching the silhouette per archetype means the swap
  changes only colour and text, never structure.
- **The Suspense fallback is the same skeleton**, at the same height. Chunk
  loading is visually indistinguishable from waiting for data, and neither
  shifts layout.

`EventSource` only issues GET requests and this endpoint is a POST carrying a
prompt, so the stream is read off the fetch body reader and the SSE framing is
parsed by hand (`useDashboardStream`). Partial events survive across chunk
boundaries.

### Optimistic update strategy

`client/src/hooks/useOptimisticAction.ts`

Sequence: **apply locally → fire the request → on failure restore the previous
value and raise a non-blocking toast.** The UI never waits on the network, and a
failure is never silent.

State is **keyed**, and rollback is **per key**. That is the whole reason the hook
is not three lines: snapshotting the entire object and restoring it wholesale is
correct only while exactly one request is in flight. With two overlapping
toggles, a failure on the first would silently revert the second. Keyed
functional updates touch only the field that actually failed.

Snapshots live in a ref, not state — they are bookkeeping for the rollback path,
and re-rendering when they change would be pure waste.

Three surfaces use it:

| Interaction | Optimistic behaviour |
|---|---|
| Checklist toggle | flips instantly; reverts with a toast on rejection |
| Widget drag-reorder | grid settles immediately; animates back if the save fails |
| Form submit | reports applied immediately; restores previous values on failure |

Pending state is signalled by a slight opacity change rather than a spinner or a
disabled control — the interaction must stay responsive.

### Responsive layout

Target range is 375px to 4K. Three states, and the panels fold at *different*
breakpoints so the workspace degrades in priority order rather than all at once:

| Viewport | Sidebar | History panel |
|---|---|---|
| ≥ 1280px (`xl`) | docked | docked |
| 1024–1280px (`lg`) | docked | drawer |
| < 1024px | drawer | drawer |

Each panel is **one element with two behaviours, switched entirely in CSS**.
`lg:static lg:translate-x-0 lg:transition-none` turns the drawer mechanics off at
the breakpoint; below it, the same element is a fixed overlay driven by a
transform. There is no media-query listener, no JS branch and no separate mobile
component to keep in sync — the only JavaScript involved is the boolean that
flips one class, so resizing costs a style recalculation rather than a re-render.

Two details that are easy to get wrong:

- **Closed drawers use `visibility: hidden`, not just a transform.** A panel that
  is off-screen but still focusable is a keyboard trap: tabbing walks into an
  invisible menu. `invisible` removes it from the tab order.
- **The transition is `transition-all`, not `transition-transform`.** Visibility
  interpolates specially — if either endpoint is visible the element stays
  visible for the whole transition — so the panel slides fully out and only then
  hides. Transitioning transform alone makes it vanish instantly on close.

Controls shed in priority order as width drops (breadcrumb trail → database
selector → language → share → composer secondaries), so the prompt, mic and send
button still fit at 375px. At the top end, `max-w-canvas` (110rem) caps line
length so the grid does not stretch across a 4K display.

### Design token system

Three themes (`dark`, `light`, `hc`) are defined as CSS custom properties on
`[data-theme]` in `client/src/styles/tokens.css`. Switching is a single attribute
write on `<html>`: it costs a style recalculation, never a React re-render or a
layout pass. No component anywhere reads a colour value.

That property has to be enforced, not just intended. Theme state lives in a
module-level store (`hooks/useTheme.ts`), and the attribute is written
**synchronously in the event handler** so the repaint starts in the same task as
the click. The only subscriber is the `ThemeSwitcher` component, which renders
which theme is active. An earlier version held this in `useState` at the root,
so one click re-rendered the entire workspace — including nine `useSortable`
hooks — before an effect applied the attribute that does the actual work.

Tokens are **semantic** (`--surface`, `--text-muted`), never literal
(`--orange-500`). That is precisely what makes a high-contrast theme achievable
without touching a single component.

Tokens reach Tailwind through `@theme inline`:

```css
@theme inline {
  --color-surface: var(--surface);
}
```

The `inline` keyword is load-bearing. It compiles `bg-surface` to
`background-color: var(--surface)` rather than baking the dark-theme hex in at
build time — without it, utilities freeze at build time and the toggle silently
does nothing.

**High contrast is not "dark mode with more contrast."** `--text-muted` resolves
to pure white (muted text is an accessibility defect, not a style), borders become
solid white so every region is delineated without relying on fill, and the ambient
glow is switched off because it reduces effective contrast behind text. The light
theme darkens the reference amber from `#e8833a` to `#b45309`, which the original
fails WCAG AA against white.

A small inline script in `index.html` applies the stored theme before first paint,
so there is no flash of the default palette on load.

A second, non-`inline` `@theme` block holds the **static scale**: shell geometry
(`w-sidebar`), icon steps (`size-icon`), the type ramp (`text-title`,
`text-micro`, `text-metric`) and `tracking-label`. These exist so components
never hardcode arbitrary values — `w-[264px]` states a number without saying what
it means and drifts the moment it is copied, whereas `w-sidebar` names the intent
and has exactly one definition. The codebase contains **zero** arbitrary Tailwind
values; the reference design's half-steps between Tailwind's defaults live in the
token scale instead.

### Micro-interactions and motion

Framer Motion for state-driven animation, CSS for everything declarative.

- Widgets **fade** in on arrival — no y-offset, no scale. Movement would read as
  the layout settling, which is the exact impression the reserved geometry
  exists to avoid.
- Toasts animate in and out via `AnimatePresence`, positioned in a corner,
  never modal, never focus-stealing, announced with `aria-live="polite"`.
- Radix menus and the schema inspector use hand-written keyframes in
  `index.css`, keyed off `data-state`.
- Skeleton shimmer animates `transform` only — a `background-position` or width
  animation would invite layout work on every frame while the stream is still
  arriving.

`<MotionConfig reducedMotion="user">` wraps the app. This is not optional polish:
the CSS `prefers-reduced-motion` block only neutralises CSS transitions, and
Framer drives its animations from JavaScript by writing inline styles frame by
frame, so it never sees that rule. Without the wrapper, a user who asked the OS
for reduced motion still receives every animation.

### Accessibility

Verified with `npm run a11y` (10 checks) plus incidental coverage in the smoke
suite. What is in place:

| Concern | How it is handled |
|---|---|
| Sidebar has ~15 links before the content | Skip link is the first focusable element |
| Closing a drawer stranded focus on `<body>` | The opening control is remembered and refocused |
| Streamed widgets appeared silently | `aria-live` region announces completion |
| Keyboard dragging was undiscoverable | dnd-kit `screenReaderInstructions` + named announcements |
| Off-screen drawers were still tabbable | Closed drawers use `visibility: hidden` |
| Card regions were unnamed | Compound `WidgetCard` wires `aria-labelledby` to the rendered label |
| Modal focus trap and restoration | Radix Dialog |

Two judgment calls worth naming:

- **The live region announces on completion, not per widget.** Nine
  announcements during one stream is chatter, not information.
- **Drag announcements name the widget** — "Picked up High Risk. Position 2 of
  9." "Item moved to position 2" would be technically compliant and practically
  useless.

The trade-off: nine drag handles sit in the tab order, so tabbing through the
dashboard passes each one. A handle reachable by keyboard has to be focusable.

### Performance

| Technique | Where | Why |
|---|---|---|
| Virtualisation | `DataTable` | ~5,000 rows ≈ 25,000 cells; only the visible window is mounted |
| `useDeferredValue` | table filter | keystrokes stay at high priority, filtering at low |
| `memo` | `WidgetRenderer` | appending widget N during a stream must not re-render widgets 1..N-1 |
| `useMemo` on validation | `WidgetRenderer` | avoids re-running zod over a 5,000-row payload each render |
| Route-level code splitting | registry | six widget chunks, loaded on demand |
| Transform-only animation | dnd-kit, shimmer, virtual rows | composited; no layout per frame |
| CSS-resolved breakpoints | `layout/spans.ts` | resizing costs a style recalc, not a re-render |

Fixed row height in the table is a deliberate simplification: variable heights
need per-row measurement, and measurement during a stream is precisely what
causes layout shift.

#### Measured results

Captured with `npm run perf` (Playwright + `PerformanceObserver`) against the
production build behind nginx:

| Metric | Desktop (1440) | Mobile (375) | Budget |
|---|---|---|---|
| LCP | **0.27s** | **0.27s** | ≤ 2.5s |
| CLS | **0.0022** | **0.0030** | ≤ 0.1 |
| Long tasks | **0** | **0** | — |
| Theme switch → paint | **34ms** | **35ms** | ≤ 100ms |
| DOM elements | **725** | **725** | — |

Headless Chromium on localhost, so absolute numbers are optimistic; the ratios
and the relative cost of each change are what these are for.

#### What measurement actually caught

Instrumentation was added because "zero CLS" and "sub-100ms response" were
architectural arguments with no numbers behind them. The first run found a bug
that had survived eleven commits:

**The table was not virtualising at all.** Its scroll container was `flex-1`
inside a cell that only had `min-height`, so nothing gave it a definite height.
It expanded to fit all 5,000 rows — 220,142px — the virtualizer measured that as
its viewport, concluded every row was visible, and mounted all of them.

The code was correct in isolation: `useVirtualizer`, `overscan`, translateY
positioning, even a footer reporting the row count. It simply never had a
bounded container to work against, and nothing failed loudly. The cost was
**30,635 DOM elements** and a **1.2-second** restyle on every theme change.

Fixing it (`height` rather than `min-height` on the table's cell) cut the DOM by
42× and the theme switch by 35×. Two other findings from the same run:

- Six of nine widgets rendered **taller than their declared `minHeight`**, since
  `min-height` is a floor rather than a fixed box. Declared heights now match
  measured render heights at both breakpoints.
- The server slept 420ms before sending the first widget — which is the LCP
  element — charging that pause directly to LCP. The first widget now ships
  immediately; everything after it still staggers.

A hypothesis that measurement **disproved**: schema validation was assumed to be
the expensive step. It is 3.1ms for 5,000 rows. The optimisation it would have
prompted would have solved nothing.

---

## API reference

Base URL: `http://localhost:8787`

### `POST /api/generate-dashboard`

Streams a dashboard as Server-Sent Events.

```jsonc
{
  "prompt": "Show me high-risk accounts",
  "injectFaults": false   // see "Demonstrating error handling"
}
```

Events: `meta` (geometry for all widgets) → `widget` × N → `done`.

Widget selection is keyword-routed from the prompt — try `"distribution"`,
`"tune agent parameters"`, or the default risk-review prompt for different plans.

### `POST /api/widget-action`

The endpoint optimistic updates reconcile against. Sleeps 350–900ms to simulate
latency, then fails according to `FAIL_RATE`.

```jsonc
{
  "widgetId": "wgt_actions",
  "action": "toggle",
  "payload": { "act_1": true },
  "forceFail": false     // force the rollback path deterministically
}
```

| Response | Meaning |
|---|---|
| `200 { ok: true, state }` | applied; merged state returned |
| `503 { ok: false, error }` | simulated rejection → client rolls back |
| `400 { ok: false, error }` | missing `widgetId` or `action` |

### `GET|POST|DELETE /api/investigations`

CRUD over the investigation history in the right-hand panel.

### `GET /api/health`

Liveness probe; reports the active `FAIL_RATE`. Used by the Compose healthcheck
that gates client startup.

---

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `8787` | server port |
| `FAIL_RATE` | `0.2` | share of `/api/widget-action` calls that fail |

`FAIL_RATE` exists so rollback is observable without editing code:

```bash
FAIL_RATE=0 docker compose up   # clean demo, nothing fails
FAIL_RATE=1 docker compose up   # every action fails; rollback every time
```

---

## Demonstrating error handling

Error handling is invisible when nothing is broken, so faults are injectable on
demand: **⋯ menu (top right) → "Inject faults"**, then send any prompt. Equivalent
to `{"injectFaults": true}` on the API.

| Injected widget | Failure mode | Expected result |
|---|---|---|
| `QUANTUM_HEATMAP_3D` | archetype with no renderer | unknown-type fallback |
| malformed `METRIC_CARD` | `value: null`, `sparkline: "not-an-array"` | invalid-payload fallback listing the zod issues |

Every other widget on the page must continue working normally.

Broken widgets remain **inspectable**: open **⋯ → Inspect schema** on the failed
card to read the raw payload that caused the rejection.

Verified against the live stream — 10 widgets valid, 2 intentional fallbacks,
0 unexpected failures.

---

## Trade-offs

**Tailwind v4 `@theme` instead of v3 `theme.extend`.** The brief specifies
`theme.extend`. Tailwind v4's `@theme` is its direct successor and is
CSS-custom-property-native, which serves the "design token synchronization"
requirement more closely than the v3 JS config did. Chosen deliberately; flagged
because it departs from the letter of the spec.

**No charting library.** The sparkline and histogram are hand-rolled — SVG for the
line, flex children for the bars. Recharts or Chart.js would add ~100KB gzipped to
draw two shapes, and both fight CSS-variable theming because they compute colours
in JS. Hand-rolled marks inherit `currentColor` and re-theme for free.

**Hand-written keyframes instead of `tailwindcss-animate`.** That plugin is
v3-era, and keeping enter/exit animations in CSS means the
`prefers-reduced-motion` block neutralises them automatically.

**The envelope reaches `WidgetCard` via context, not props.** The card renders
several levels below the resolver, inside each widget. Threading the envelope
through props would add a parameter to six components that none of them use,
purely to hand it to a sibling of their own content.

**Drag is bound to a handle, not the card body.** Widgets own scroll areas,
sliders and text inputs; making the whole card a drag source would steal the
pointer from every one of them.

**nginx serves the client in Docker, not `vite dev`.** The reviewer gets the
production build — real bundle sizes, real caching, a 50MB image with no Node in
the serving layer. Hot reload remains available via the local-Node path.

**`tsx` runs the server directly rather than compiling.** For a mock server a
build step buys nothing; `devDependencies` are intentionally retained in the
server image for this reason. A production service would compile.

**Separate `package.json` files, no monorepo tooling.** Turborepo or pnpm
workspaces would add configuration surface without helping two packages that
share no code.

---

## Known gaps

Stated plainly rather than left to be discovered.

**Main bundle is 649kB (202kB gzip).** Widget archetypes are code-split into
their own chunks, but Framer Motion, dnd-kit, Radix and zod all land in the entry
chunk. Splitting the motion and drag libraries behind the first interaction would
be the obvious next win.

**Performance numbers come from headless Chromium on localhost.** They are
optimistic against a real device on a real network. The instrumentation is in
the app (⋯ → Performance overlay) so the same metrics can be read in any browser.

**Sidebar and history navigation are presentational.** Nothing is wired to a
router. Deliberate: routing would consume time that belongs in the widget runtime,
which is what this exercise grades.

**No test suite.** Given the time budget, effort went into making failure modes
visible at runtime (fault injection, the inspector, typed fallbacks) rather than
into coverage.

**Contrast ratios are reasoned about, not formally audited.** `--text-dim`
(`#7a6f66` on `#1a1614`) is approximately 3.3:1, below the 4.5:1 WCAG AA minimum
for body text, and it is used on timestamps, table labels and captions. The
high-contrast theme has not been measured at all. This is the one accessibility
item still outstanding.

---

## Troubleshooting

**`Cannot connect to the Docker daemon`** — Docker Desktop is not running.

**Port 5173 or 8787 already in use** — a previous `npm run dev` is still alive.
`lsof -ti:8787 | xargs kill -9`, or change the mapping in `docker-compose.yml`.

**All widgets appear at once instead of streaming** — a proxy is buffering the SSE
response. `client/nginx.conf` sets `proxy_buffering off` for exactly this reason;
any additional proxy layer needs the same treatment.

**Actions keep failing** — that is `FAIL_RATE=0.2` working as designed. Run with
`FAIL_RATE=0` for a clean demo.
