/**
 * Maps a 12-column span onto responsive Tailwind classes.
 *
 * Resolving breakpoints in CSS rather than JS is deliberate: a matchMedia-driven
 * approach would re-render every widget on resize, and during a stream that
 * competes with the work of mounting arriving widgets. These classes are static,
 * so resizing costs a style recalc and nothing else.
 *
 * The grid is always 12 columns; only the spans change per breakpoint.
 */
export function spanToClass(span: number): string {
  switch (true) {
    case span >= 12:
      return 'col-span-12'
    case span >= 8:
      return 'col-span-12 lg:col-span-8'
    case span >= 6:
      // Full width on phones, half from md up — the reference's 2-up bottom row.
      return 'col-span-12 md:col-span-6'
    case span >= 4:
      return 'col-span-12 sm:col-span-6 lg:col-span-4'
    case span >= 3:
      // 2-up on phones, 4-up on desktop — the KPI row.
      return 'col-span-6 lg:col-span-3'
    default:
      return 'col-span-6 sm:col-span-4 lg:col-span-2'
  }
}

/* ---------------------------------------------------------------------------
 * Column count from the payload's `layout` field.
 *
 * The schema declares `grid-2-col` / `grid-3-col` / `grid-4-col`, and that has
 * to mean something or the field is decoration. The matrix stays 12 columns
 * internally — it divides cleanly by 2, 3 and 4 — and a widget's requested span
 * is snapped to the nearest boundary the declared layout allows.
 *
 * So in `grid-3-col` a widget asking for 3/12 is widened to 4/12 (one third),
 * and in `grid-4-col` it stays at 3/12 (one quarter). The model expresses
 * intent; the layout decides the grid it lands on.
 * ------------------------------------------------------------------------ */

export type LayoutKind = 'grid-2-col' | 'grid-3-col' | 'grid-4-col'

const COLUMNS: Record<LayoutKind, number> = {
  'grid-2-col': 2,
  'grid-3-col': 3,
  'grid-4-col': 4,
}

export function snapSpan(span: number, layout: LayoutKind): number {
  const unit = 12 / COLUMNS[layout]
  // Never smaller than one column, never wider than the full row.
  return Math.min(12, Math.max(unit, Math.round(span / unit) * unit))
}
