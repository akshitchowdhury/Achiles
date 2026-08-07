import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { PlanDrum, type DrumEntry } from './PlanDrum'
import { PlanDrumSkeleton } from './PlanDrumSkeleton'
import { useImagesSettled } from '../../hooks/useDecodedImage'
import { usePlanPreview } from '../../hooks/usePlanPreview'
import { isPlanSlug, type PlanSlug, type TrainingPlan } from '../../types'

interface PlanPickerProps {
  plans: TrainingPlan[]
  /** The persisted plan, so the drum opens on the athlete's real theme. */
  committed: PlanSlug | null
  selected: PlanSlug | null
  onSelect: (slug: PlanSlug) => void
  labelledBy: string
  /** Fires with the slug currently applied to the document, so the page's
   *  watermark stays in lockstep with the palette. */
  onActiveChange?: (slug: PlanSlug | null) => void
}

/**
 * A single-choice control over the plan catalogue, implemented as a radiogroup
 * on a rotating drum.
 *
 * The two modalities that used to disagree — pointer previewed, keyboard
 * selected — now collapse into one rule: THE CARD IN FRONT IS THE CHOICE.
 * Whatever brings a card to the front (a wheel notch, a swipe, an arrow key, a
 * chevron, a click on a card off to the side) selects it, themes the app and
 * swaps the watermark behind the page. Committing is still a separate press on
 * the page, so nothing is decided by scrolling past.
 *
 * Plans whose slug the client does not recognise are dropped rather than shown:
 * an unknown server slug has no theme, no layout and no place on the barrel.
 */
export function PlanPicker({
  plans,
  committed,
  selected,
  onSelect,
  labelledBy,
  onActiveChange,
}: PlanPickerProps) {
  // Baseline is the current selection rather than the persisted plan: the drum
  // always has a card in front, so the screen is always previewing something,
  // and reverting to `committed` would fight it.
  const { previewNow, active } = usePlanPreview(selected ?? committed)
  const [announced, setAnnounced] = useState('')
  /** Which card has been announced. Keyed on the index rather than a "have I
   *  spoken yet" flag so a REPEAT of the same card says nothing: the drum
   *  reports its front card on mount, StrictMode reports it twice, and a
   *  background refetch of the catalogue would report it again. None of those
   *  is a choice the athlete made. */
  const spokenFor = useRef<number | null>(null)

  const entries = useMemo<DrumEntry[]>(
    () => plans.flatMap((plan) => (isPlanSlug(plan.slug) ? [{ plan, slug: plan.slug }] : [])),
    [plans],
  )

  // Gate the drum on its cards' own photos, not just the catalogue fetch —
  // otherwise five cover images pop in one at a time as each card's own
  // useDecodedImage resolves, right as the barrel is trying to look solid.
  const imagesReady = useImagesSettled(entries.map((entry) => entry.plan.image_url))
  const reduce = useReducedMotion()

  // Read once: the drum owns its position from then on, and re-deriving this
  // from `selected` would yank the barrel back mid-spin.
  const opening = useRef(-1)
  if (opening.current < 0) {
    const at = entries.findIndex((entry) => entry.slug === (selected ?? committed))
    opening.current = at < 0 ? 0 : at
  }

  const onFront = useCallback(
    (index: number) => {
      const entry = entries[index]
      if (!entry) return
      onSelect(entry.slug)
      previewNow(entry.slug)
      if (spokenFor.current !== null && spokenFor.current !== index) {
        setAnnounced(`${entry.plan.name} selected. Theme applied.`)
      }
      spokenFor.current = index
    },
    [entries, onSelect, previewNow],
  )

  useEffect(() => {
    onActiveChange?.(active)
  }, [active, onActiveChange])

  if (entries.length === 0) {
    return (
      <p className="text-ink-dim text-sm">
        The catalogue came back with plans this build does not recognise, so there is nothing to
        theme. Re-seed it through /addPlans with the five known slugs.
      </p>
    )
  }

  return (
    <>
      {imagesReady ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.32, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <PlanDrum
            entries={entries}
            initialIndex={opening.current}
            onFront={onFront}
            labelledBy={labelledBy}
          />
        </motion.div>
      ) : (
        <PlanDrumSkeleton count={entries.length} />
      )}

      {/* Selection speaks. The drum settles before this fires, so spinning
          through three cards announces the one you stopped on, not all three. */}
      <p role="status" className="sr-only">
        {announced}
      </p>
    </>
  )
}
