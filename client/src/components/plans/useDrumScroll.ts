import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMotionValue, type MotionValue } from 'motion/react'

/**
 * Turns a horizontal scroll container into the drive shaft of a drum.
 *
 * The scroll position IS the drum's angle — nothing is hijacked and nothing is
 * pinned. That is the whole design decision here, and it buys a lot: touch
 * flings, trackpad swipes, the scrollbar, snap points and focus-into-view all
 * keep working because they are the browser's, not ours. What the hook adds is
 * three things the browser has no opinion about:
 *
 *   1. `progress` — where the viewport centre sits, in slot units, as a
 *      MotionValue. Slots read it to place themselves on the barrel. It is a
 *      MotionValue and not state on purpose: a drum that re-rendered React on
 *      every scroll frame would drop frames on the first fling.
 *   2. `index` — the card actually in front, committed only once the scroll
 *      has SETTLED. This is the one that changes the theme, and repainting the
 *      whole page mid-fling is the thing to avoid.
 *   3. a wheel gesture, because a plain mouse wheel produces deltaY and a
 *      horizontal container ignores it. Without this the drum is dead to
 *      roughly every desktop mouse.
 */

/** How long the drum must hold still before the card in front counts as chosen.
 *  Under the ~120ms causality threshold, so a deliberate step still reads as
 *  instant, but long enough that spinning past three cards writes one theme. */
const SETTLE_MS = 90

/** A wheel gesture steps the drum once it has pushed this far, then goes quiet
 *  for the cooldown. Trackpad momentum arrives as a long tail of small deltas;
 *  fed straight through it would spin past every card in one flick. */
const WHEEL_THRESHOLD = 40
const WHEEL_COOLDOWN_MS = 320
/** A pause this long starts a fresh gesture instead of adding to the last. */
const WHEEL_IDLE_MS = 180

/** deltaMode: 0 px, 1 lines, 2 pages. Firefox is the one that uses lines. */
function wheelPixels(delta: number, mode: number): number {
  if (mode === 1) return delta * 16
  if (mode === 2) return delta * 400
  return delta
}

export interface DrumScroll {
  scrollerRef: React.RefObject<HTMLDivElement | null>
  /** Position of the viewport centre in slot units — 2.5 means halfway between
   *  the third and fourth card. Continuous, and updated per scroll frame. */
  progress: MotionValue<number>
  /** One slot plus one gap, in px. Measured, not assumed: the slot width is a
   *  clamp() against both vw and svh, so only the DOM knows it. */
  step: MotionValue<number>
  /** The card in front, after the scroll settled. */
  index: number
  /** Spin to a card. Wraps, because a drum goes round. `jump` skips the
   *  animation — used for the initial position and for resizes. */
  goTo: (next: number, jump?: boolean) => void
}

export function useDrumScroll(count: number, initial: number, reduce: boolean): DrumScroll {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const progress = useMotionValue(initial)
  const step = useMotionValue(1)
  const [index, setIndex] = useState(initial)

  /** Scroll offset that puts card 0 under the viewport centre. Should be 0 —
   *  the leading pad is sized for exactly that — but it is measured rather than
   *  assumed so a rounding error cannot drift the whole drum sideways. */
  const origin = useRef(0)
  const settle = useRef<number | undefined>(undefined)
  const countRef = useRef(count)
  const indexRef = useRef(initial)
  const firstIndex = useRef(initial)
  countRef.current = count
  indexRef.current = index

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const slots = el.querySelectorAll<HTMLElement>('[data-drum-slot]')
    const first = slots[0]
    if (!first) return
    // offsetLeft, not getBoundingClientRect: the slots are rotated in 3D, so
    // their painted rects are trapezoids and their widths are foreshortened.
    // offsetLeft/offsetWidth report the untransformed layout box, which is what
    // the scroll geometry is actually made of.
    const pitch = slots.length > 1 ? slots[1].offsetLeft - first.offsetLeft : first.offsetWidth
    if (pitch > 0) step.set(pitch)
    origin.current = first.offsetLeft + first.offsetWidth / 2 - el.clientWidth / 2
  }, [step])

  const goTo = useCallback(
    (next: number, jump = false) => {
      const el = scrollerRef.current
      const total = countRef.current
      if (!el || total === 0) return

      const target = ((next % total) + total) % total
      const left = Math.max(
        0,
        Math.min(el.scrollWidth - el.clientWidth, origin.current + target * step.get()),
      )

      // Committing here rather than waiting for the settle timer: a button
      // press, an arrow key or a wheel notch is already a deliberate choice, so
      // the theme and the watermark should start changing as the drum turns,
      // not a beat after it stops.
      window.clearTimeout(settle.current)
      setIndex(target)

      if (jump) {
        // scrollTo fires nothing when the position does not move, so seed the
        // barrel angle directly or the first paint places every card at 0.
        el.scrollTo({ left, behavior: 'auto' })
        progress.set((el.scrollLeft - origin.current) / (step.get() || 1))
        return
      }
      el.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' })
    },
    [progress, reduce, step],
  )

  // Position before first paint, so the drum never flashes at card 0 and then
  // jumps to the athlete's committed plan.
  useLayoutEffect(() => {
    measure()
    goTo(firstIndex.current, true)
  }, [measure, goTo])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    const onScroll = () => {
      progress.set((el.scrollLeft - origin.current) / (step.get() || 1))
      window.clearTimeout(settle.current)
      settle.current = window.setTimeout(() => {
        const nearest = Math.max(
          0,
          Math.min(countRef.current - 1, Math.round(progress.get())),
        )
        setIndex(nearest)
      }, SETTLE_MS)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.clearTimeout(settle.current)
    }
  }, [progress, step])

  // Re-measure on anything that can change the pitch: a window resize, and the
  // slot itself, whose width is a clamp() against svh — a mobile URL bar
  // collapsing resizes the card without resizing the rail.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      measure()
      goTo(indexRef.current, true)
    })
    observer.observe(el)
    const slot = el.querySelector<HTMLElement>('[data-drum-slot]')
    if (slot) observer.observe(slot)
    return () => observer.disconnect()
  }, [measure, goTo])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    let carried = 0
    let lastAt = 0
    let coolUntil = 0

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return // pinch-zoom
      const dy = wheelPixels(event.deltaY, event.deltaMode)
      const dx = wheelPixels(event.deltaX, event.deltaMode)
      // A genuinely horizontal gesture is the scroll container's own business —
      // it already does the right thing, and intercepting it would fight the
      // trackpad's momentum with ours.
      if (Math.abs(dx) > Math.abs(dy)) return
      if (dy === 0) return

      const at = indexRef.current
      // No wrapping on the wheel, unlike the buttons: past the last card the
      // gesture belongs to the page again. Trapping the wheel in a five-item
      // carousel is how a page becomes impossible to scroll past.
      if ((dy > 0 && at >= countRef.current - 1) || (dy < 0 && at <= 0)) return

      event.preventDefault()

      const now = Date.now()
      if (now - lastAt > WHEEL_IDLE_MS || Math.sign(dy) !== Math.sign(carried)) carried = 0
      lastAt = now
      carried += dy

      if (now < coolUntil || Math.abs(carried) < WHEEL_THRESHOLD) return
      coolUntil = now + WHEEL_COOLDOWN_MS
      goTo(at + Math.sign(carried))
      carried = 0
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [goTo])

  return { scrollerRef, progress, step, index, goTo }
}
