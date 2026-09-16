/* ============================================================================
 * Incoming payload schemas
 * ---------------------------------------------------------------------------
 * The server and client both describe the widget contract, and that duplication
 * is deliberate. A shared type package would give compile-time agreement but
 * zero runtime protection, and the payloads here originate from a language
 * model — the one source that will confidently emit a shape that type-checks
 * nowhere. Every widget is parsed before it reaches a component.
 *
 * Validation failure is a normal, expected outcome, not an exception. It routes
 * the widget to a fallback renderer and leaves the rest of the workspace intact.
 * ========================================================================= */

import { z } from 'zod'

/* --- Envelope ------------------------------------------------------------- */

export const widgetLayoutSchema = z.object({
  /** Columns out of 12. Clamped rather than rejected: a bad span is a layout
   *  nuisance, not a reason to refuse to render the widget's data. */
  span: z.number().int().min(1).max(12).catch(6),
  /** Space reserved before data arrives. This is the CLS guarantee. */
  minHeight: z.number().min(0).max(2000).catch(160),
})

export const widgetEnvelopeSchema = z.object({
  id: z.string().min(1),
  // Intentionally an open string. See note in server/src/types.ts: constraining
  // this to known archetypes would make the unknown-widget case unrepresentable
  // in types while remaining entirely possible at runtime.
  type: z.string().min(1),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  layout: widgetLayoutSchema,
  data: z.unknown(),
})

export type WidgetEnvelope = z.infer<typeof widgetEnvelopeSchema>

/* --- Shared leaves -------------------------------------------------------- */

export const statusSchema = z.enum(['success', 'warning', 'danger', 'neutral']).catch('neutral')
export type Status = z.infer<typeof statusSchema>

/* --- Per-archetype payloads ----------------------------------------------- */

export const narrativeHeaderSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  chips: z
    .array(
      z.object({
        label: z.string(),
        icon: z.enum(['verified', 'database', 'audit']).catch('verified'),
        tone: statusSchema,
      }),
    )
    .default([]),
})
export type NarrativeHeaderData = z.infer<typeof narrativeHeaderSchema>

export const metricCardSchema = z.object({
  value: z.string(),
  unit: z.string().optional(),
  trend: z
    .object({
      direction: z.enum(['up', 'down']),
      pct: z.string(),
    })
    .optional(),
  caption: z.string().optional(),
  status: statusSchema,
  sparkline: z.array(z.number()).default([]),
})
export type MetricCardData = z.infer<typeof metricCardSchema>

export const dataTableSchema = z.object({
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        align: z.enum(['left', 'right']).catch('left'),
        numeric: z.boolean().optional(),
        sortable: z.boolean().optional(),
      }),
    )
    .min(1),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  filterKey: z.string(),
  filterPlaceholder: z.string().default('Filter…'),
})
export type DataTableData = z.infer<typeof dataTableSchema>

export const checklistSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      done: z.boolean().catch(false),
    }),
  ),
  actionEndpoint: z.string().default('/api/widget-action'),
})
export type ChecklistData = z.infer<typeof checklistSchema>

export const distributionChartSchema = z.object({
  bins: z
    .array(
      z.object({
        label: z.string(),
        count: z.number(),
      }),
    )
    .min(1),
  xLabel: z.string().default(''),
  peakIndex: z.number().int().min(0).catch(0),
})
export type DistributionChartData = z.infer<typeof distributionChartSchema>

export const formFieldSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('slider'),
    name: z.string(),
    label: z.string(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive().catch(1),
    default: z.number(),
  }),
  z.object({
    type: z.literal('toggle'),
    name: z.string(),
    label: z.string(),
    default: z.boolean(),
  }),
  z.object({
    type: z.literal('select'),
    name: z.string(),
    label: z.string(),
    options: z.array(z.string()).min(1),
    default: z.string(),
  }),
  z.object({
    type: z.literal('text'),
    name: z.string(),
    label: z.string(),
    placeholder: z.string().optional(),
    default: z.string(),
    maxLength: z.number().int().positive().optional(),
    required: z.boolean().optional(),
  }),
])
export type FormField = z.infer<typeof formFieldSchema>

export const dynamicFormSchema = z.object({
  fields: z.array(formFieldSchema).min(1),
  submitLabel: z.string().default('Submit'),
  actionEndpoint: z.string().default('/api/widget-action'),
})
export type DynamicFormData = z.infer<typeof dynamicFormSchema>

/* --- Stream envelope ------------------------------------------------------ */

export const placeholderSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string().optional(),
  layout: widgetLayoutSchema,
})
export type Placeholder = z.infer<typeof placeholderSchema>

export const dashboardMetaSchema = z.object({
  investigationId: z.string(),
  prompt: z.string(),
  layout: z.enum(['grid-2-col', 'grid-3-col', 'grid-4-col']).catch('grid-3-col'),
  theme: z.enum(['dark', 'light', 'hc']).catch('dark'),
  breadcrumb: z.array(z.string()).default([]),
  widgetCount: z.number().int().nonnegative(),
  placeholders: z.array(placeholderSchema).default([]),
})
export type DashboardMeta = z.infer<typeof dashboardMetaSchema>

export const investigationSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  createdAt: z.number(),
})
export type Investigation = z.infer<typeof investigationSchema>
