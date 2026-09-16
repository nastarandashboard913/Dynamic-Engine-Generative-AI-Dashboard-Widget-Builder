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
