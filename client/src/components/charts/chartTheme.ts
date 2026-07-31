/**
 * Shared chart chrome. Values mirror the tokens in index.css — Recharts needs
 * concrete colours for SVG attributes, so they're resolved here in one place
 * rather than scattered through the chart components.
 */
export const CHART = {
  grid: '#24272d',
  axis: '#333740',
  surface: '#14161a',
  raised: '#1c1f25',
  ink: '#f5f7f2',
  inkDim: '#a8aeb8',
  inkMuted: '#8a9099',
  /** Categorical slots — fixed order, never cycled. */
  series: ['#7a9e19', '#3b82d9', '#d4459b'] as const,
  /** Ordinal lime ramp, low → high magnitude. */
  ramp: ['#4a5f14', '#5f7a19', '#7a9e19', '#9cc426', '#c0ec33'] as const,
  status: {
    good: '#0ca30c',
    warning: '#fab219',
    serious: '#ec835a',
    critical: '#d03b3b',
    neutral: '#8a9099',
  },
} as const

/** Recharts axis tick styling — muted, recessive, tabular for aligned ticks. */
export const AXIS_TICK = {
  fill: CHART.inkMuted,
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
} as const

/** Tooltip container styling shared by every chart. */
export const TOOLTIP_STYLE = {
  background: CHART.raised,
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 12,
  fontSize: 12,
  padding: '8px 10px',
  color: CHART.ink,
  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
} as const
