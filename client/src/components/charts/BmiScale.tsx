import { BMI_BANDS, BMI_SCALE_MAX, BMI_SCALE_MIN, bmiScalePosition } from '../../lib/fitness'
import type { Tone } from '../../lib/fitness'
import { decimal } from '../../lib/format'
import { CHART } from './chartTheme'

interface BmiScaleProps {
  bmi: number
  tone: Tone
}

const span = BMI_SCALE_MAX - BMI_SCALE_MIN
const widthOf = (from: number, to: number) => ((to - from) / span) * 100

/**
 * A meter, not a chart: one value against the WHO band scale.
 *
 * The bands themselves stay neutral — four competing status colours can't be
 * told apart reliably side by side. Only the reader's own position is coloured,
 * and the verdict badge beside it carries an icon and a text label.
 */
export function BmiScale({ bmi, tone }: BmiScaleProps) {
  const left = bmiScalePosition(bmi)
  const markerColor = CHART.status[tone]

  return (
    <figure className="mt-2">
      {/* Value flag, pinned above the marker */}
      <div className="relative mb-2 h-6">
        <div
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${left}%` }}
        >
          <span
            className="text-plane rounded-md px-1.5 py-0.5 text-xs font-semibold"
            style={{ background: markerColor }}
          >
            {decimal(bmi)}
          </span>
        </div>
      </div>

      {/* Track: 2px surface gaps do the separating between bands */}
      <div className="relative">
        <div className="flex h-2.5 gap-0.5" role="presentation">
          {BMI_BANDS.map((band) => {
            const from = Math.max(band.from, BMI_SCALE_MIN)
            const to = Math.min(band.to, BMI_SCALE_MAX)
            return (
              <div
                key={band.label}
                style={{ width: `${widthOf(from, to)}%` }}
                className={
                  band.label === 'Healthy'
                    ? 'bg-hairline-strong rounded-full'
                    : 'bg-grid rounded-full'
                }
              />
            )
          })}
        </div>

        {/* Marker needle — ringed in the surface colour so it stays legible
            wherever it lands on the track. */}
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${left}%` }}
        >
          <span
            className="ring-surface block size-3.5 rounded-full ring-2"
            style={{ background: markerColor }}
          />
        </div>
      </div>

      {/* Band labels */}
      <div className="mt-2 flex gap-0.5">
        {BMI_BANDS.map((band) => {
          const from = Math.max(band.from, BMI_SCALE_MIN)
          const to = Math.min(band.to, BMI_SCALE_MAX)
          return (
            <div
              key={band.label}
              style={{ width: `${widthOf(from, to)}%` }}
              className="text-ink-muted text-[10px]"
            >
              <span className="tabular-nums">{band.from === 0 ? BMI_SCALE_MIN : band.from}</span>
              <span className="ml-1">{band.label}</span>
            </div>
          )
        })}
      </div>

      <figcaption className="sr-only">
        Body mass index {decimal(bmi)} plotted on the World Health Organization
        scale from {BMI_SCALE_MIN} to {BMI_SCALE_MAX}.
      </figcaption>
    </figure>
  )
}
