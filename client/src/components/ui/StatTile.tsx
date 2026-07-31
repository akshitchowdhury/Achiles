import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface StatTileProps {
  label: string
  value: ReactNode
  unit?: string
  /** Short clarifier — mark estimates as estimates here. */
  hint?: string
  icon?: LucideIcon
  className?: string
}

/**
 * A single current value. Deliberately not a one-bar chart.
 * Values use proportional figures — tabular-nums is for aligned columns only.
 */
export function StatTile({ label, value, unit, hint, icon: Icon, className }: StatTileProps) {
  return (
    <div
      className={clsx(
        'border-hairline bg-surface rounded-2xl border p-4',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-ink-muted text-xs font-medium">{label}</p>
        {Icon && <Icon className="text-ink-muted size-4" aria-hidden="true" />}
      </div>
      <p className="text-ink mt-2 text-2xl font-semibold tracking-tight">
        {value}
        {unit && <span className="text-ink-muted ml-1 text-sm font-normal">{unit}</span>}
      </p>
      {hint && <p className="text-ink-muted mt-1 text-xs">{hint}</p>}
    </div>
  )
}
