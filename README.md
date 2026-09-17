# Dynamic Engine

**Generative AI Dashboard & Widget Builder.** The frontend does not know what the
dashboard looks like. It receives a stream of widget schemas from an LLM backend,
resolves each one to a React component at runtime, and renders whatever arrives —
including archetypes it has never seen, which degrade to an explained fallback
instead of taking down the page.

React 19 · TypeScript (strict) · Tailwind v4 · Express · Radix · Lucide

---

## Run it

```bash
docker compose up --build        # client :5173 · API :8787
```

<details>
<summary>Local Node instead</summary>

```bash
npm install && npm run setup && npm run dev
```
Requires Node 20+. Vite proxies `/api`, so both modes behave identically.
</details>

---

## Measured, not asserted

```bash
npm run perf      # LCP, CLS, long tasks, theme-switch cost
npm run smoke     # 19 functional checks
npm run a11y      # 10 keyboard / screen-reader checks
npm run contrast  # 64 text styles × 3 themes
```

| | Desktop | Mobile (375px) | Budget |
|---|---|---|---|
| LCP | 0.27s | 0.27s | ≤ 2.5s |
| CLS | 0.0022 | 0.0030 | ≤ 0.1 |
| Long tasks | 0 | 0 | — |
| Theme switch → paint | 34ms | 35ms | ≤ 100ms |
| Contrast (all 3 themes) | 64/64 pass | | ≥ 4.5:1 |

Headless Chromium on localhost, so optimistic — but reproducible.

**These scripts exist because measurement found a bug code review missed.** The
table was not virtualising at all: its scroll container had no definite height,
so it mounted all 5,000 rows. 30,635 DOM elements, and a 1.2s restyle on every
theme change. The README, a commit message, and a UI footer all claimed it
worked. → [detail](docs/ARCHITECTURE.md#what-measurement-actually-caught)

---

## Architecture

### Dynamic Component Registry — `client/src/features/registry/`

One entry per archetype, binding a zod schema to a lazily-imported component.
Adding an archetype touches no other file.

Every payload passes four gates, each with its own failure mode:

| Gate | Mechanism | On failure |
|---|---|---|
| Resolve | registry lookup | unknown-type fallback |
| Validate | `schema.safeParse` | invalid-payload fallback + issues |
| Load | `React.lazy` + Suspense | the widget's own skeleton |
| Render | error boundary | render-error fallback + retry |

Three decisions worth knowing:

- **Schema and component are bound together**, so no component is reachable
  without its validator. There is no path that renders unvalidated data.
- **`type` is typed as `string`**, not a union of known archetypes. A model will
  eventually emit something unknown; a closed union would make that
  unrepresentable at compile time while it stays possible at runtime.
- **Error boundaries are per widget, not per grid.** One boundary around the
  workspace satisfies "does not crash" while still blanking the whole page.

### Zero-CLS streaming

The SSE stream sends a `meta` event containing a placeholder for **every** widget
— id, type, span, reserved height — *before any widget data exists*. The grid
renders the full geometry on the first event, then swaps skeletons for content
inside boxes that never change size.

Skeletons are type-aware: a metric-card skeleton looks like a metric card, so the
swap changes colour and text but never structure.

### Optimistic updates — `client/src/hooks/useOptimisticAction.ts`

Apply locally → fire the request → on failure restore the previous value and
raise a non-blocking toast. Used by the checklist, the form, and drag-reorder.

State is **keyed**, and rollback is **per key**. Snapshotting the whole object is
correct only while one request is in flight; with two overlapping toggles, a
failure on the first would silently revert the second.

`/api/widget-action` fails 20% of the time by default so this is observable —
`FAIL_RATE=0` for a clean demo, `FAIL_RATE=1` to force it.

### Design tokens

Three themes as CSS custom properties on `[data-theme]`. Switching is one
attribute write: a style recalculation, never a re-render. Tokens are semantic
(`--surface`, `--text-muted`), which is what makes a high-contrast theme possible
without touching a component.

**High contrast is not "dark with more contrast"** — muted text resolves to pure
white, borders become solid white, and the ambient glow is switched off because
it reduces effective contrast behind text.

---

## Trade-offs

| Decision | Why |
|---|---|
| Tailwind v4 `@theme` over v3 `theme.extend` | The brief specifies `theme.extend`; v4's `@theme` is its CSS-variable-native successor. Deliberate departure. |
| No charting library | Sparkline and histogram are hand-rolled SVG/flex. Recharts would add ~100kB to draw two shapes and fights CSS-variable theming. |
| Drag bound to a handle, not the card | Widgets own scroll areas, sliders and inputs; a whole-card drag source steals the pointer from all of them. |
| Fixed table row height | Variable heights need per-row measurement, and measuring during a stream is what causes layout shift. |
| CSS animations, not Framer Motion | The brief allows either. Framer cost 41kB gzip — 19% of the bundle — for six animations CSS already expresses. Only the toast exit needed JavaScript. |
| Node/Express, not FastAPI | The brief names both. Node keeps one language for a React role; the wire contract is identical. |
| Secondary text brighter than the mock | The reference's dim grey measures 3.67:1 — below WCAG AA. Accessibility won. |

---

## Known gaps

Named here rather than left to be found.

- **Sidebar and history navigation are presentational.** No router. Routing would
  consume time that belongs in the widget runtime, which is what this grades.
- **No maintained test suite.** The four scripts above are diagnostics, not
  coverage.
- **~565kB of vendor code** (177kB gzip), split into cacheable chunks. React is
  65kB gzip of that; Radix, zod and dnd-kit account for most of the rest and are
  all load-bearing. Application code is 13kB gzip.
- **Performance numbers are headless-on-localhost** — optimistic against a real
  device. The same metrics are readable in any browser via ⋯ → Performance
  overlay.

---

## Demo controls

**⋯ menu (top right):**
- **Inject faults** — adds an unknown archetype and a malformed payload to the
  next generation. Both must render contained fallbacks while everything else
  keeps working.
- **Performance overlay** — live CLS, long tasks, input latency, validation cost.

Any widget's **⋯ → Inspect schema** shows the raw payload the model emitted —
including for widgets that failed to render, which is when it is most useful.

---

Deeper detail, API reference and the full measurement write-up:
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**
