import clsx from 'clsx'

interface PlanDrumSkeletonProps {
  /** How many cards the real drum is about to render, so the placeholder
   *  shows the same number of dot indicators beneath the row. */
  count: number
}

/** Neighbours shown fading out either side of centre. Fixed rather than
 *  derived from the barrel's own maths — this is a placeholder shape, not a
 *  preview of PlanDrum's geometry, so it only needs to look plausible. */
const MAX_SLOTS = 5

/**
 * Stands in for the drum while every card's cover photo is still loading.
 *
 * Deliberately not a preview of the barrel itself — reproducing PlanDrum's
 * perspective and scroll maths for a state that only exists for a moment, on
 * first load, would be a lot of geometry to maintain for something nobody
 * looks at twice. This only has to promise "cards are coming, roughly here,
 * roughly this shape": a static row, clipped to the same slot width the real
 * drum uses so nothing jumps in height when it takes over.
 */
export function PlanDrumSkeleton({ count }: PlanDrumSkeletonProps) {
  const slots = Math.min(Math.max(count, 1), MAX_SLOTS)
  const centre = (slots - 1) / 2

  return (
    <div className="drum" role="status" aria-live="polite">
      <div
        aria-hidden="true"
        className="flex items-center justify-center overflow-hidden py-6"
        style={{ gap: 'var(--drum-gap)' }}
      >
        {Array.from({ length: slots }, (_, i) => {
          const distance = Math.abs(i - centre)
          return (
            <div
              key={i}
              className="shrink-0"
              style={{
                width: 'var(--drum-slot)',
                transform: `scale(${(1 - distance * 0.1).toFixed(2)})`,
                opacity: Math.max(1 - distance * 0.32, 0.15),
              }}
            >
              <div className="cyl aspect-[31/44] w-full">
                {/* Literal colour, not a token, same as .cyl-shade: this
                    stands in for the photo layer and must not repaint when
                    the picker's previewed theme changes underneath it. */}
                <div className="bg-hairline-strong absolute inset-0 animate-pulse" />
                <div className="cyl-face space-y-2">
                  <div className="h-4 w-3/5 rounded-full bg-white/20" />
                  <div className="h-2.5 w-full rounded-full bg-white/10" />
                  <div className="h-2.5 w-4/5 rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mirrors PlanDrum's own controls row so the picker does not change
          height when the real drum takes over. */}
      <div aria-hidden="true" className="mt-5 flex items-center justify-center gap-4">
        <div className="bg-raised size-10 shrink-0 animate-pulse rounded-full" />
        <span className="flex items-center gap-1.5">
          {Array.from({ length: slots }, (_, i) => (
            <span
              key={i}
              className={clsx(
                'bg-raised h-1.5 animate-pulse rounded-full',
                i === Math.round(centre) ? 'w-5' : 'w-1.5',
              )}
            />
          ))}
        </span>
        <div className="bg-raised size-10 shrink-0 animate-pulse rounded-full" />
      </div>

      <p className="text-ink-muted mt-3 text-center text-[11px]">Loading plan artwork…</p>
    </div>
  )
}
