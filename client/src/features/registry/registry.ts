import { lazy } from 'react'
import {
  checklistSchema,
  dataTableSchema,
  distributionChartSchema,
  dynamicFormSchema,
  metricCardSchema,
  narrativeHeaderSchema,
} from '@/types/schema'
import type { RegistryEntry } from './types'

/* ============================================================================
 * The Dynamic Component Registry
 * ---------------------------------------------------------------------------
 * The single place where a wire-format string becomes a React component.
 *
 * Three properties are deliberate:
 *
 * 1. SCHEMA AND COMPONENT ARE BOUND TOGETHER. A component is only reachable
 *    through its own validator, so no widget can render unvalidated data. The
 *    schema is not a separate step a future contributor can forget.
 *
 * 2. EVERY COMPONENT IS LAZY. Each archetype is its own chunk, so a dashboard
 *    of four metric cards never downloads the virtualised table or the form
 *    runtime. The registry knowing the whole catalogue costs nothing at load.
 *
 * 3. ADDING AN ARCHETYPE IS ONE ENTRY. No switch statement elsewhere, no
 *    changes to the renderer, the grid or the stream handler.
 * ========================================================================= */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const widgetRegistry: Record<string, RegistryEntry<any>> = {
  NARRATIVE_HEADER: {
    label: 'Narrative Header',
    schema: narrativeHeaderSchema,
    Component: lazy(() =>
      import('../widgets/NarrativeHeader').then((m) => ({ default: m.NarrativeHeader })),
    ),
  },
  METRIC_CARD: {
    label: 'Metric Card',
    schema: metricCardSchema,
    Component: lazy(() => import('../widgets/MetricCard').then((m) => ({ default: m.MetricCard }))),
  },
  DATA_TABLE: {
    label: 'Data Table',
    schema: dataTableSchema,
    Component: lazy(() => import('../widgets/DataTable').then((m) => ({ default: m.DataTable }))),
  },
  CHECKLIST: {
    label: 'Checklist',
    schema: checklistSchema,
    Component: lazy(() => import('../widgets/Checklist').then((m) => ({ default: m.Checklist }))),
  },
  DISTRIBUTION_CHART: {
    label: 'Distribution Chart',
    schema: distributionChartSchema,
    Component: lazy(() =>
      import('../widgets/DistributionChart').then((m) => ({ default: m.DistributionChart })),
    ),
  },
  DYNAMIC_FORM: {
    label: 'Dynamic Form',
    schema: dynamicFormSchema,
    Component: lazy(() =>
      import('../widgets/DynamicForm').then((m) => ({ default: m.DynamicForm })),
    ),
  },
}

export function resolveWidget(type: string): RegistryEntry | undefined {
  return widgetRegistry[type]
}

export function isKnownWidget(type: string): boolean {
  return type in widgetRegistry
}

/** Archetypes this client can render — useful for docs and debugging. */
