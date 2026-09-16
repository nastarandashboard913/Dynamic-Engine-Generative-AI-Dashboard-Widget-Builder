import { useMemo } from 'react'

interface SparklineProps {
  points: number[]
  className?: string
}

/**
 * Hand-rolled SVG sparkline.
 *
 * A charting library would add ~100KB gzipped to draw a polyline, and most of
 * them fight CSS-variable theming because they compute colours in JS. This
 * inherits `currentColor`, so it re-themes for free when the palette changes.
 *
 * `preserveAspectRatio="none"` lets the fixed 100x32 viewBox stretch to any
 * container width without a resize observer or a re-render.
 */
export function Sparkline({ points, className }: SparklineProps) {
  const path = useMemo(() => {
    if (points.length < 2) return null

    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    const stepX = 100 / (points.length - 1)

    const coords = points.map((p, i) => {
      const x = i * stepX
      // SVG y grows downward; invert so higher values sit higher.
      const y = 32 - ((p - min) / range) * 28 - 2
      return [x, y] as const
    })

    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const area = `${line} L100,32 L0,32 Z`

    return { line, area }
  }, [points])

  if (!path) return null

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d={path.area} fill="currentColor" opacity={0.12} />
      <path
        d={path.line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
