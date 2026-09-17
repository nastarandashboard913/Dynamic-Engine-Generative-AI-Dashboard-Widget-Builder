/* ============================================================================
 * Dashboard generator — the stand-in for the LLM.
 * ---------------------------------------------------------------------------
 * Maps a natural-language prompt onto a widget plan. Crude keyword routing is
 * deliberate: the point of the exercise is what the CLIENT does with an
 * arbitrary widget list, so this side stays legible rather than clever.
 * ========================================================================= */

import { accounts, riskDistribution, stats } from './db.ts'
import type {
  ChecklistData,
  DashboardMeta,
  DataTableData,
  DistributionChartData,
  DynamicFormData,
  MetricCardData,
  NarrativeHeaderData,
  WidgetEnvelope,
} from './types.ts'

const fmt = new Intl.NumberFormat('en-US')

function sparkline(seed: number, points = 12): number[] {
  const out: number[] = []
  let v = 40 + (seed % 20)
  for (let i = 0; i < points; i++) {
    v = Math.max(6, Math.min(100, v + (Math.sin(seed + i * 1.7) * 18 + (i % 3) * 4)))
    out.push(Math.round(v))
  }
  return out
}

/* --- Widget builders ------------------------------------------------------ */

function narrativeHeader(): WidgetEnvelope<NarrativeHeaderData> {
  return {
    id: 'wgt_narrative',
    type: 'NARRATIVE_HEADER',
    // span 12 = full width. minHeight reserves the space the streamed text
    // will occupy, so later widgets never get pushed down (CLS = 0).
    layout: { span: 12, minHeight: 132 },
    data: {
      headline: `${fmt.format(stats.highRisk)} accounts are high-risk — ${fmt.format(stats.critical)} are critical.`,
      summary: `Concentrated in the South-East; ${accounts[0]?.account ?? 'n/a'} tops the list at ${accounts[0]?.score.toFixed(2) ?? '0.00'}.`,
      chips: [
        { label: 'High Confidence', icon: 'verified', tone: 'success' },
        { label: 'Sourced from customers_db · 4 tables', icon: 'database', tone: 'neutral' },
        { label: 'Audit-logged', icon: 'audit', tone: 'neutral' },
      ],
    },
  }
}

function metricCards(): WidgetEnvelope<MetricCardData>[] {
  const defs: Array<[string, MetricCardData]> = [
    ['High Risk', {
      value: fmt.format(stats.highRisk),
      trend: { direction: 'down', pct: '3.2%' },
      status: 'danger',
      sparkline: sparkline(3),
    }],
    ['Critical', {
      value: fmt.format(stats.critical),
      trend: { direction: 'down', pct: '1.1%' },
      status: 'danger',
      sparkline: sparkline(11),
    }],
    ['Avg Risk Score', {
      value: stats.avgScore.toFixed(2),
      // The schema's sample payload carries `unit` (e.g. "req/sec"); emitting it
      // here keeps the client's rendering path exercised rather than dead code.
      unit: '/ 1.00',
      caption: 'High-risk cohort',
      status: 'warning',
      sparkline: sparkline(7),
    }],
    ['Flagged Today', {
      value: fmt.format(stats.flaggedToday),
      trend: { direction: 'down', pct: '10%' },
      status: 'success',
      sparkline: sparkline(19),
    }],
  ]

  return defs.map(([title, data], i) => ({
    id: `wgt_metric_${i + 1}`,
    type: 'METRIC_CARD',
    title,
    // Four across on a 12-col matrix. The client collapses this responsively.
    // Measured: 164px rendered (label + value + trend slot + sparkline).
    layout: { span: 3, minHeight: 168 },
    data,
  }))
}

function topAccountsTable(): WidgetEnvelope<DataTableData> {
  return {
    id: 'wgt_table',
    type: 'DATA_TABLE',
    title: 'Top accounts by risk',
    layout: { span: 12, minHeight: 420 },
    data: {
      columns: [
        { key: 'account', label: 'Account', align: 'left', sortable: true },
        { key: 'exposure', label: 'Exposure', align: 'left', numeric: true, sortable: true },
        { key: 'segment', label: 'Segment', align: 'left', sortable: true },
        { key: 'score', label: 'Score', align: 'right', numeric: true, sortable: true },
        { key: 'region', label: 'Region', align: 'right', sortable: true },
      ],
      // Full dataset ships to the client. That is the point: it forces the
      // table to virtualise rather than hiding the problem behind pagination.
      rows: accounts.map((a) => ({
        account: a.account,
        exposure: `SAR ${a.exposure.toFixed(1)}M`,
        segment: a.segment,
        score: a.score.toFixed(2),
        region: a.region,
      })),
      filterKey: 'account',
      filterPlaceholder: 'Filter accounts…',
    },
  }
}

function recommendedActions(): WidgetEnvelope<ChecklistData> {
  return {
    id: 'wgt_actions',
    type: 'CHECKLIST',
    title: 'Recommended actions',
    layout: { span: 6, minHeight: 268 },
    data: {
      items: [
        { id: 'act_1', label: `Review ${fmt.format(stats.critical)} critical accounts`, done: false },
        { id: 'act_2', label: 'Freeze new credit for the top 5 segments', done: false },
        { id: 'act_3', label: 'Alert the risk team this week', done: false },
        { id: 'act_4', label: 'Schedule review with relationship managers', done: false },
      ],
      actionEndpoint: '/api/widget-action',
    },
  }
}

function distribution(): WidgetEnvelope<DistributionChartData> {
  const bins = riskDistribution()
  let peakIndex = 0
  bins.forEach((b, i) => {
    if (b.count > (bins[peakIndex]?.count ?? 0)) peakIndex = i
  })
  return {
    id: 'wgt_distribution',
    type: 'DISTRIBUTION_CHART',
    title: 'Risk score distribution',
    layout: { span: 6, minHeight: 268 },
    data: { bins, xLabel: 'Risk score', peakIndex },
  }
}

function agentParams(): WidgetEnvelope<DynamicFormData> {
  return {
    id: 'wgt_form',
    type: 'DYNAMIC_FORM',
    title: 'Agent Parameter Adjuster',
    subtitle: 'Tune how the next investigation is run',
    // Measured: 479px rendered (four fields, each with a fixed error slot).
    layout: { span: 6, minHeight: 490 },
    data: {
      fields: [
        { name: 'temperature', label: 'Model Temperature', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.7 },
        { name: 'fallbackMode', label: 'Enable Fallback', type: 'toggle', default: true },
        { name: 'depth', label: 'Analysis Depth', type: 'select', options: ['Quick scan', 'Full Analysis', 'Deep audit'], default: 'Full Analysis' },
        { name: 'note', label: 'Reviewer Note', type: 'text', placeholder: 'Optional context…', default: '', maxLength: 80, required: true },
      ],
      submitLabel: 'Apply parameters',
      actionEndpoint: '/api/widget-action',
    },
  }
}

/* --- Fault injection ------------------------------------------------------ */
/**
 * Two deliberately broken widgets, emitted only when the client asks for them
 * via the "Inject faults" toggle. They exercise the two failure paths the brief
 * calls out: an archetype the registry has never heard of, and a known
 * archetype whose payload does not match its schema.
 */
function faultyWidgets(): WidgetEnvelope[] {
  return [
    {
      id: 'wgt_unknown',
      type: 'QUANTUM_HEATMAP_3D',
      title: 'Quantum Heatmap',
      layout: { span: 6, minHeight: 220 },
      data: { nodes: [1, 2, 3] },
    },
    {
      id: 'wgt_malformed',
      type: 'METRIC_CARD',
      title: 'Malformed Metric',
      layout: { span: 6, minHeight: 220 },
      // `value` must be a string and `sparkline` an array of numbers.
      data: { value: null, sparkline: 'not-an-array', status: 'explode' },
    },
  ]
}

/* --- Plan ----------------------------------------------------------------- */

export interface GenerateOptions {
  prompt: string
  injectFaults?: boolean
}

export function planDashboard({ prompt, injectFaults }: GenerateOptions): {
  meta: DashboardMeta
  widgets: WidgetEnvelope[]
} {
  const p = prompt.toLowerCase()

  const widgets: WidgetEnvelope[] = [narrativeHeader(), ...metricCards()]

  // Keyword routing stands in for the model deciding which archetypes fit.
  if (p.includes('distribut') || p.includes('spread') || p.includes('histogram')) {
    widgets.push(distribution(), recommendedActions())
  } else {
    widgets.push(topAccountsTable(), recommendedActions(), distribution())
  }

  if (p.includes('tune') || p.includes('parameter') || p.includes('agent') || p.includes('config')) {
    widgets.unshift(agentParams())
  } else {
    widgets.push(agentParams())
  }

  if (injectFaults) widgets.push(...faultyWidgets())

  return {
    meta: {
      investigationId: `inv_${Date.now().toString(36)}`,
      prompt,
      // Four columns: the KPI row is four cards wide in the reference design, and
      // `layout` now decides what a widget's span snaps to, so this has to state
      // the grid the plan was built for.
      layout: p.includes('distribut') || p.includes('spread') ? 'grid-2-col' : 'grid-4-col',
      theme: 'dark',
      breadcrumb: ['Investigation', 'High Risk Accounts Review'],
      widgetCount: widgets.length,
    },
    widgets,
  }
}
