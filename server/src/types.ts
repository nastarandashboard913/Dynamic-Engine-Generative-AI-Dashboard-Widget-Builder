/* ============================================================================
 * Widget contract
 * ---------------------------------------------------------------------------
 * This is the payload shape an LLM would emit. It is intentionally a DISCRIMINATED
 * UNION on `type`: the frontend registry switches on that one field to pick a
 * renderer, and TypeScript can then narrow `data` correctly per archetype.
 *
 * `type` is typed as `string`, not the union of known kinds, on purpose. A real
 * model will eventually emit an archetype the client does not know about, and
 * the client must render a fallback rather than crash. Pretending that cannot
 * happen at the type level would hide the exact failure mode we are asked to
 * handle gracefully.
 * ========================================================================= */

export type WidgetType =
  | 'NARRATIVE_HEADER'
  | 'METRIC_CARD'
  | 'DATA_TABLE'
  | 'CHECKLIST'
  | 'DISTRIBUTION_CHART'
  | 'DYNAMIC_FORM'

export type LayoutKind = 'grid-2-col' | 'grid-3-col' | 'grid-4-col'
export type ThemeKind = 'dark' | 'light' | 'hc'
export type Status = 'success' | 'warning' | 'danger' | 'neutral'

/** How much horizontal room a widget claims in the 12-column matrix. */
export interface WidgetLayout {
  /** Columns spanned out of 12. Clamped client-side. */
  span: number
  /** Reserved height in px BEFORE data arrives. This is what buys us zero CLS. */
  minHeight: number
}

export interface WidgetEnvelope<T = unknown> {
  id: string
  type: string
  title?: string
  subtitle?: string
  layout: WidgetLayout
  data: T
}

/* --- Per-archetype payloads ---------------------------------------------- */

export interface NarrativeHeaderData {
  headline: string
  summary: string
  chips: Array<{
    label: string
    icon: 'verified' | 'database' | 'audit'
    tone: Status
  }>
}

export interface MetricCardData {
  value: string
  unit?: string
  trend?: { direction: 'up' | 'down'; pct: string }
  caption?: string
  status: Status
  sparkline: number[]
}

export interface DataTableColumn {
  key: string
  label: string
  align: 'left' | 'right'
  /** Render with the tabular-numeric font so columns line up. */
  numeric?: boolean
  sortable?: boolean
}

export interface DataTableData {
  columns: DataTableColumn[]
  /** Row count can be large; the client virtualises rather than paginating. */
  rows: Array<Record<string, string | number>>
  filterKey: string
  filterPlaceholder: string
}

export interface ChecklistData {
  items: Array<{ id: string; label: string; done: boolean }>
  actionEndpoint: string
}

export interface DistributionChartData {
  bins: Array<{ label: string; count: number }>
  xLabel: string
  peakIndex: number
}

export type FormField =
  | { name: string; label: string; type: 'slider'; min: number; max: number; step: number; default: number }
  | { name: string; label: string; type: 'toggle'; default: boolean }
  | { name: string; label: string; type: 'select'; options: string[]; default: string }
  | { name: string; label: string; type: 'text'; placeholder?: string; default: string; maxLength?: number; required?: boolean }

export interface DynamicFormData {
  fields: FormField[]
  submitLabel: string
  actionEndpoint: string
}

export interface DashboardMeta {
  investigationId: string
  prompt: string
  layout: LayoutKind
  theme: ThemeKind
  breadcrumb: string[]
  widgetCount: number
}
