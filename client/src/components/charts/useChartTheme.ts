import { useMemo } from 'react'
import { useSession } from '../../store/session'

/**
 * Resolves the chart palette from the active plan's tokens.
 *
 * Why a hook and not a constant: Recharts needs concrete colour values because
 * most of its colour props (`fill`, `stroke`, `stopColor`) land on the DOM as
 * SVG *presentation attributes*, and `var()` does not resolve there. So instead
 * of pushing `var(--color-series-1)` into props, we read the computed value off
 * the root element — where theme/plan-themes.css has already applied the plan's
 * override — and hand Recharts a plain hex.
 *
 * `var()` IS fine in real inline `style` objects, which is why MacroSplitBar can
 * use it directly and does not need this hook.
 *
 * Keyed on planSlug: the tokens only change when the plan does, so this
 * recomputes exactly then. It reads during render rather than in an effect
 * because the first paint needs real colours, and by the time any component
 * renders the stylesheet is already parsed.
 */

export interface ChartTheme {
  grid: string
  axis: string
  surface: string
  raised: string
  ink: string
  inkDim: string
  inkMuted: string
  /** Categorical slots — fixed order, never cycled. */
  series: [string, string, string]
  /** Ordinal ramp, low → high magnitude. */
  ramp: [string, string, string, string, string]
  status: {
    good: string
    warning: string
    serious: string
    critical: string
    neutral: string
  }
  /** Recharts axis tick styling — muted, recessive. */
  axisTick: { fill: string; fontSize: number; fontVariantNumeric: string }
  /** Tooltip container styling shared by every chart. */
  tooltipStyle: React.CSSProperties
  /** Bar-hover backdrop. Follows the plan's hover wash. */
  cursorFill: string
}

function readTokens(): ChartTheme {
  // One getComputedStyle call; each getPropertyValue after it is a cheap lookup.
  const style = getComputedStyle(document.documentElement)
  const read = (name: string) => style.getPropertyValue(name).trim()

  const ink = read('--color-ink')
  const inkDim = read('--color-ink-dim')
  const inkMuted = read('--color-ink-muted')
  const raised = read('--color-raised')

  return {
    grid: read('--color-grid'),
    axis: read('--color-axis'),
    surface: read('--color-surface'),
    raised,
    ink,
    inkDim,
    inkMuted,
    series: [read('--color-series-1'), read('--color-series-2'), read('--color-series-3')],
    ramp: [
      read('--color-ramp-1'),
      read('--color-ramp-2'),
      read('--color-ramp-3'),
      read('--color-ramp-4'),
      read('--color-ramp-5'),
    ],
    status: {
      good: read('--color-good'),
      warning: read('--color-warning'),
      serious: read('--color-serious'),
      critical: read('--color-critical'),
      neutral: inkMuted,
    },
    axisTick: { fill: inkMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' },
    tooltipStyle: {
      background: raised,
      border: `1px solid ${read('--color-hairline-strong')}`,
      borderRadius: 12,
      fontSize: 12,
      padding: '8px 10px',
      color: ink,
      boxShadow: read('--shadow-overlay'),
    },
    cursorFill: read('--color-hover-wash'),
  }
}

export function useChartTheme(): ChartTheme {
  const planSlug = useSession((s) => s.planSlug)
  return useMemo(readTokens, [planSlug])
}
