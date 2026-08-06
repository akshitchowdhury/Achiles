import { useState } from 'react'
import clsx from 'clsx'
import { num } from '../../lib/format'
import type { MacroTarget } from '../../lib/fitness'

interface MacroSplitBarProps {
  target: MacroTarget
}

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const

/**
 * Part-to-whole across three macros — a stacked bar, built in plain HTML so the
 * 2px surface gap between segments is exact. Segment width tracks each macro's
 * share of *calories* (fat carries 9 kcal/g, so grams would misstate the split).
 *
 * A legend is always present; hover adds the per-segment detail.
 */
export function MacroSplitBar({ target }: MacroSplitBarProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const rows = (
    [
      // var() rather than the useChartTheme hook: these land in real inline
      // `style` objects, where custom properties resolve normally — so the
      // segments re-colour with the plan without a JS read.
      { key: 'protein', label: 'Protein', grams: target.protein, color: 'var(--color-series-1)' },
      { key: 'carbs', label: 'Carbs', grams: target.carbs, color: 'var(--color-series-2)' },
      { key: 'fat', label: 'Fat', grams: target.fat, color: 'var(--color-series-3)' },
    ] as const
  ).map((row) => {
    const kcal = row.grams * KCAL_PER_G[row.key]
    return { ...row, kcal }
  })

  const totalKcal = rows.reduce((sum, row) => sum + row.kcal, 0) || 1

  return (
    <figure>
      {/* Stack. 2px gaps in the surface colour separate the segments. */}
      <div className="flex h-3 gap-0.5" role="presentation">
        {rows.map((row, index) => (
          <div
            key={row.key}
            onMouseEnter={() => setHovered(row.key)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: `${(row.kcal / totalKcal) * 100}%`,
              background: row.color,
              opacity: hovered && hovered !== row.key ? 0.45 : 1,
            }}
            className={clsx(
              'transition-opacity',
              index === 0 && 'rounded-l-full',
              index === rows.length - 1 && 'rounded-r-full',
            )}
          />
        ))}
      </div>

      {/* Legend doubles as the value table — identity never rests on colour. */}
      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li
            key={row.key}
            onMouseEnter={() => setHovered(row.key)}
            onMouseLeave={() => setHovered(null)}
            className="flex items-center gap-2.5 text-sm"
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: row.color }}
            />
            <span className="text-ink-dim flex-1">{row.label}</span>
            <span className="text-ink font-medium tabular-nums">{num.format(row.grams)} g</span>
            <span className="text-ink-muted w-10 text-right text-xs tabular-nums">
              {Math.round((row.kcal / totalKcal) * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <figcaption className="text-ink-muted mt-4 text-xs">
        Estimated split for a {num.format(target.calories)} kcal day.
      </figcaption>
    </figure>
  )
}
