import { healthyWeightRange } from '../../lib/fitness'
import { num } from '../../lib/format'
import { CHART } from './chartTheme'

interface WeightRangeMeterProps {
  weightKg: number
  heightCm: number
}

/**
 * One value against a target band — the meter form. The healthy zone is the
 * 18.5–25 BMI window converted to kilograms for this height.
 */
export function WeightRangeMeter({ weightKg, heightCm }: WeightRangeMeterProps) {
  const { min, max } = healthyWeightRange(heightCm)

  // Pad the scale so the marker never sits flush against an edge.
  const pad = Math.max(10, (max - min) * 0.6)
  const scaleMin = Math.min(min - pad, weightKg - 4)
  const scaleMax = Math.max(max + pad, weightKg + 4)
  const span = scaleMax - scaleMin

  const pct = (value: number) => ((value - scaleMin) / span) * 100

  const inRange = weightKg >= min && weightKg <= max
  const delta = inRange ? 0 : weightKg < min ? weightKg - min : weightKg - max
  const markerColor = inRange ? CHART.status.good : CHART.status.serious

  return (
    <figure>
      <div className="flex items-baseline justify-between">
        <p className="text-ink text-2xl font-semibold tracking-tight">
          {num.format(weightKg)}
          <span className="text-ink-muted ml-1 text-sm font-normal">kg</span>
        </p>
        <p className="text-ink-muted text-xs">
          Target {num.format(min)}–{num.format(max)} kg
        </p>
      </div>

      <div className="relative mt-4">
        {/* Track, with the healthy window raised out of the base tone */}
        <div className="bg-grid h-2.5 w-full rounded-full" />
        <div
          className="bg-hairline-strong absolute top-0 h-2.5 rounded-full"
          style={{ left: `${pct(min)}%`, width: `${pct(max) - pct(min)}%` }}
        />

        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct(weightKg)}%` }}
        >
          <span
            className="ring-surface block size-3.5 rounded-full ring-2"
            style={{ background: markerColor }}
          />
        </div>
      </div>

      <figcaption className="text-ink-muted mt-3 text-xs">
        {inRange
          ? 'Inside the healthy range for your height.'
          : `${Math.abs(Math.round(delta))} kg ${delta > 0 ? 'above' : 'below'} the healthy range for your height.`}
      </figcaption>
    </figure>
  )
}
