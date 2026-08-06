import { useCallback, useEffect, useRef, useState } from 'react'
import { PlanCylinderCard } from './PlanCylinderCard'
import { usePlanPreview } from '../../hooks/usePlanPreview'
import { isPlanSlug, type PlanSlug, type TrainingPlan } from '../../types'

interface PlanPickerProps {
  plans: TrainingPlan[]
  /** The persisted plan, so reverting lands on the athlete's real theme. */
  committed: PlanSlug | null
  selected: PlanSlug | null
  onSelect: (slug: PlanSlug) => void
  labelledBy: string
  /** Fires with the slug currently applied to the document — after the enter
   *  gate, not on raw hover — so the page's watermark stays in lockstep with the
   *  palette instead of racing ahead of it. */
  onActiveChange?: (slug: PlanSlug | null) => void
}

/**
 * A single-choice control over the plan catalogue, implemented as a radiogroup.
 *
 * The two modalities behave conventionally rather than identically, which is the
 * deliberate resolution of a real tension here:
 *   - pointer: hover previews the theme, click selects
 *   - keyboard: arrow keys move focus AND select, per the WAI-ARIA radio
 *     pattern — so focus, preview and selection collapse into one action, and
 *     there is no invented "press Space to confirm" step
 * Either way, committing is a separate button press on the page.
 *
 * Plans whose slug the client does not recognise are rendered but not
 * selectable — an unknown server slug must never become a theme.
 */
export function PlanPicker({
  plans,
  committed,
  selected,
  onSelect,
  labelledBy,
  onActiveChange,
}: PlanPickerProps) {
  // The revert target is the current selection, not the persisted plan:
  // selecting applies a theme immediately and committing is a separate press,
  // so reverting to `committed` would strip the theme back off the moment the
  // pointer or focus left the card that was just chosen.
  const { preview, previewNow, revert, suppressed, active } = usePlanPreview(selected ?? committed)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [announced, setAnnounced] = useState('')

  const themable = plans.filter((plan) => isPlanSlug(plan.slug))

  useEffect(() => {
    onActiveChange?.(active)
  }, [active, onActiveChange])

  const choose = useCallback(
    (slug: PlanSlug, name: string) => {
      onSelect(slug)
      previewNow(slug)
      setAnnounced(`${name} selected. Theme applied.`)
    },
    [onSelect, previewNow],
  )

  /** Roving tabindex: the selected card, else the first, is the single tab stop. */
  const activeIndex = Math.max(
    0,
    themable.findIndex((plan) => plan.slug === selected),
  )

  const onKeyDown = useCallback(
    (index: number) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const last = themable.length - 1
      let next: number | null = null

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1
      else if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = last
      else if (event.key === 'Escape') {
        revert()
        return
      }

      if (next == null) return
      event.preventDefault()
      const plan = themable[next]
      if (!isPlanSlug(plan.slug)) return
      refs.current[next]?.focus()
      choose(plan.slug, plan.name)
    },
    [themable, choose, revert],
  )

  // Leaving the group entirely reverts the preview; moving between cards inside
  // it does not, which is why this checks relatedTarget.
  const onBlurGroup = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) revert()
  }

  // Touch: no hover, so the preview follows the scroll-centred card. Deferred
  // to scroll idle — previewing mid-fling would repaint the page during a
  // scroll, which is far worse than a slight delay.
  const railRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const rail = railRef.current
    if (!rail || !window.matchMedia('(hover: none)').matches) return

    let idle: number | undefined
    const onScroll = () => {
      window.clearTimeout(idle)
      idle = window.setTimeout(() => {
        const mid = rail.scrollLeft + rail.clientWidth / 2
        let best = 0
        let bestGap = Infinity
        Array.from(rail.children).forEach((child, i) => {
          const node = child as HTMLElement
          const centre = node.offsetLeft + node.offsetWidth / 2
          const gap = Math.abs(centre - mid)
          if (gap < bestGap) {
            bestGap = gap
            best = i
          }
        })
        const plan = themable[best]
        if (plan && isPlanSlug(plan.slug)) preview(plan.slug)
      }, 120)
    }

    rail.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      rail.removeEventListener('scroll', onScroll)
      window.clearTimeout(idle)
    }
  }, [themable, preview])

  return (
    <>
      <div
        ref={railRef}
        role="radiogroup"
        aria-labelledby={labelledBy}
        onBlur={onBlurGroup}
        className="cyl-rail -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5"
      >
        {themable.map((plan, index) => (
          <div key={plan.id} className="w-62 shrink-0 snap-center sm:w-auto">
            <PlanCylinderCard
              plan={plan}
              slug={plan.slug as PlanSlug}
              selected={selected === plan.slug}
              tabbable={index === activeIndex}
              showChips={suppressed}
              onSelect={() => choose(plan.slug as PlanSlug, plan.name)}
              onPreview={() => preview(plan.slug as PlanSlug)}
              onRevert={revert}
              onKeyDown={onKeyDown(index)}
              registerRef={(node) => {
                refs.current[index] = node
              }}
            />
          </div>
        ))}
      </div>

      {/* Selection speaks; the preview never does. A live region firing on
          every hover across five cards would be unusable noise, and colour is
          not information a screen-reader user can act on. */}
      <p role="status" className="sr-only">
        {announced}
      </p>
    </>
  )
}
