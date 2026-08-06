import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { PlanCylinderCard } from './PlanCylinderCard'
import { useDrumScroll } from './useDrumScroll'
import type { PlanSlug, TrainingPlan } from '../../types'

/* Drum geometry. A second, much larger barrel than the one inside each card:
 * there the facets carry one photo around a 254px radius, here whole cards ride
 * a radius of roughly one and a half card-steps.
 *
 *   turn        38° between neighbours
 *   radius      1/38° in radians ≈ 1.51 steps
 *   at step 276px: R ≈ 416px, the ±2 card sits 315px back and 76° edge-on
 * against perspective ≈ 5 × the card width, so the foreshortening scales with
 * the cards instead of collapsing on a phone.
 *
 * Fixing the ARC between neighbours at exactly one step — rather than the chord
 * — is what keeps the front cards where the scroll actually put them. The
 * compression then builds toward the rim, which is where a drum should show it,
 * instead of pinching the gap you are looking straight at. */
const TURN_DEG = 38
const TURN_RAD = (TURN_DEG * Math.PI) / 180
const RADIUS = 1 / TURN_RAD
/** Cards stop turning one notch short of edge-on (2.3 × 38° = 87.4°). Past 90°
 *  a card starts presenting its back, and the rim would flicker inside-out. */
const TURN_LIMIT = 2.3
/** Beyond this the card is transparent, so it must also stop swallowing clicks
 *  — an invisible card parked at the rim is still a hit target. */
const OFFSTAGE = 2.4

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** `offset` is signed distance from the front, in slots: +1 is one card right. */
function turn(offset: number): number {
  return clamp(offset, -TURN_LIMIT, TURN_LIMIT) * TURN_DEG
}

/** Where the card sits across the barrel, MINUS where the scroll already put
 *  it — the transform is a correction onto the circle, not a position. */
function barrelX(offset: number, step: number): number {
  return (RADIUS * Math.sin((turn(offset) * Math.PI) / 180) - offset) * step
}

function barrelZ(offset: number, step: number): number {
  return (RADIUS * Math.cos((turn(offset) * Math.PI) / 180) - RADIUS) * step
}

/** Cards do not fade because they are far away — perspective handles that. They
 *  fade because five plans compete for one decision, and the one facing you
 *  should be the only one that reads as an option. */
function fade(offset: number): number {
  return clamp(1.12 - 0.42 * Math.abs(offset), 0, 1)
}

function lift(offset: number): number {
  return 1 + 0.05 * (1 - Math.min(Math.abs(offset), 1))
}

interface DrumSlotProps {
  index: number
  progress: MotionValue<number>
  step: MotionValue<number>
  /** Reduced motion: the drum degrades to a plain snap rail, no 3D at all. */
  flat: boolean
  offstage: boolean
  onFocus: () => void
  children: ReactNode
}

function DrumSlot({ index, progress, step, flat, offstage, onFocus, children }: DrumSlotProps) {
  // One derived value per transform channel. motion composes them in the order
  // translate → scale → rotate, which is exactly the order the barrel needs:
  // rotate the card in place, then carry it out to its chord.
  const x = useTransform([progress, step], ([p, s]: number[]) => barrelX(index - p, s))
  const z = useTransform([progress, step], ([p, s]: number[]) => barrelZ(index - p, s))
  const rotateY = useTransform(progress, (p: number) => turn(index - p))
  const opacity = useTransform(progress, (p: number) => fade(index - p))
  const scale = useTransform(progress, (p: number) => lift(index - p))

  if (flat) {
    return (
      <div data-drum-slot className="drum-slot" onFocus={onFocus}>
        {children}
      </div>
    )
  }

  // The transform goes on an INNER element, never on the slot. The slot is what
  // the scroll container measures itself against, and the barrel maths pulls
  // the far cards inward — transform the slot and the scrollable width
  // collapses to the visible width, which leaves the drum with no scroll range
  // to derive its angle from. It renders, and then nothing moves, ever.
  return (
    <div data-drum-slot className="drum-slot" onFocus={onFocus}>
      <motion.div
        className="drum-card"
        style={{ x, z, rotateY, opacity, scale, pointerEvents: offstage ? 'none' : 'auto' }}
      >
        {children}
      </motion.div>
    </div>
  )
}

export interface DrumEntry {
  plan: TrainingPlan
  slug: PlanSlug
}

interface PlanDrumProps {
  /** Themable plans only, in catalogue order. Never empty. */
  entries: DrumEntry[]
  /** Where the drum starts — the athlete's committed plan, if they have one. */
  initialIndex: number
  /** Fires when a different card comes to the front, including once on mount.
   *  Must be referentially stable. */
  onFront: (index: number) => void
  labelledBy: string
}

/**
 * The plan picker as a rotating drum.
 *
 * The card facing you IS the choice — there is no separate hover-to-preview and
 * click-to-select any more. Spinning the drum selects, applies the theme and
 * swaps the background watermark on one tick, which is the only model that
 * makes sense once the cards are on a barrel: you cannot meaningfully "hover"
 * a card that is turned 76° away from you.
 *
 * Everything drives the same scroll position, so every input agrees:
 *   wheel / swipe / trackpad → the scroll container itself
 *   ← → Home End             → focus moves, and the drum follows the focus
 *   the chevrons             → one card, wrapping
 *   clicking any card        → brings that card to the front
 */
export function PlanDrum({ entries, initialIndex, onFront, labelledBy }: PlanDrumProps) {
  const reduce = useReducedMotion()
  const flat = reduce === true
  const { scrollerRef, progress, step, index, goTo } = useDrumScroll(
    entries.length,
    initialIndex,
    flat,
  )
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    onFront(index)
  }, [index, onFront])

  const onKeyDown = useCallback(
    (from: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const last = entries.length - 1
      let next: number | null = null

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = from === last ? 0 : from + 1
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = from === 0 ? last : from - 1
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = last

      if (next == null) return
      event.preventDefault()
      // preventScroll and then centre it ourselves. The browser's own
      // scroll-into-view stops as soon as the card is barely on screen, which
      // parks it at the rim edge-on — and its scroll would race ours.
      refs.current[next]?.focus({ preventScroll: true })
      goTo(next)
    },
    [entries.length, goTo],
  )

  return (
    <div className="drum">
      <div
        ref={scrollerRef}
        role="radiogroup"
        aria-labelledby={labelledBy}
        className="drum-scroller"
      >
        <div className="drum-track">
          {/* Half a viewport of nothing at each end: without it the first and
              last cards can never reach the centre of the barrel. */}
          <span className="drum-pad" aria-hidden="true" />

          {entries.map((entry, i) => (
            <DrumSlot
              key={entry.plan.id}
              index={i}
              progress={progress}
              step={step}
              flat={flat}
              offstage={Math.abs(i - index) > OFFSTAGE}
              onFocus={() => goTo(i)}
            >
              <PlanCylinderCard
                plan={entry.plan}
                slug={entry.slug}
                selected={i === index}
                tabbable={i === index}
                // The card in front owns the whole screen's palette, so it has
                // no use for chips. The ones turned away do: it is the only
                // colour they get to show while someone else is themed.
                showChips={i !== index}
                onSelect={() => goTo(i)}
                onKeyDown={onKeyDown(i)}
                registerRef={(node) => {
                  refs.current[i] = node
                }}
              />
            </DrumSlot>
          ))}

          <span className="drum-pad" aria-hidden="true" />
        </div>
      </div>

      {/* Controls sit outside the radiogroup. The chevrons are the discoverable
          affordance — the wheel and the arrow keys are faster once you know
          they exist, but nothing on screen says so. */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Previous plan"
          onClick={() => goTo(index - 1)}
          className="border-hairline-strong text-ink-dim hover:text-volt hover:border-volt/50 flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        {/* Indicator only. The radios already are the control, and a second
            focusable copy of a five-way choice is noise in a tab order. */}
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {entries.map((entry, i) => (
            <span
              key={entry.slug}
              className={clsx(
                'h-1.5 rounded-full transition-all duration-300',
                i === index ? 'bg-volt w-5' : 'bg-hairline-strong w-1.5',
              )}
            />
          ))}
        </span>

        <button
          type="button"
          aria-label="Next plan"
          onClick={() => goTo(index + 1)}
          className="border-hairline-strong text-ink-dim hover:text-volt hover:border-volt/50 flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-ink-muted mt-3 text-center text-[11px]">
        Scroll, swipe or use the arrow keys to spin the drum.
      </p>
    </div>
  )
}
