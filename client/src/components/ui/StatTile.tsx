import clsx from 'clsx'
import type { ReactNode } from 'react'
// Wider than LucideIcon on purpose — the manga plan's stat icons are hand-drawn
// SVGs, and a tile must not care which it was handed. See planMotif.
import type { MotifIcon } from '../../theme/planMotif'

interface StatTileProps {
  label: string
  value: ReactNode
  unit?: string
  /** Short clarifier — mark estimates as estimates here. */
  hint?: string
  icon?: MotifIcon
  className?: string
}

/**
 * A single current value. Deliberately not a one-bar chart.
 *
 * The label and the value carry no font utilities of their own: .plan-eyebrow
 * and .plan-metric own family, weight, case and size so a plan can set its
 * figures in a condensed italic or a Japanese gothic. See the note at the head
 * of the dashboard block in plan-shells.css for why a utility here would win
 * and break that.
 *
 * Values use proportional figures by default — the two plans that want
 * tabular-nums (a scoreboard and an instrument readout) opt in from CSS.
 */
export function StatTile({ label, value, unit, hint, icon: Icon, className }: StatTileProps) {
  return (
    <div
      className={clsx(
        'border-hairline bg-surface rounded-2xl border p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="plan-eyebrow text-ink-muted">{label}</p>
        {/* The plan's accent, not muted ink: on a five-tile row the icon is the
            fastest thing to read, and it is the cheapest place to carry the
            plan's colour. aria-hidden, so this is decoration only. */}
        {Icon && <Icon className="text-volt size-4 shrink-0 opacity-80" aria-hidden="true" />}
      </div>
      <p className="plan-metric text-ink mt-2">
        {value}
        {unit && <span className="text-ink-muted font-sans ml-1 text-sm font-normal">{unit}</span>}
      </p>
      {hint && <p className="text-ink-muted font-sans mt-1 text-xs">{hint}</p>}
    </div>
  )
}
