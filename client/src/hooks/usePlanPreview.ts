import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlanSlug } from '../types'

/** Pointer must rest this long before a preview is written. Under the ~120ms
 *  causality threshold, so a deliberate hover still feels instant, but long
 *  enough that a sweep (30–60ms per card) writes nothing. */
const ENTER_GATE_MS = 90
/** Reverting waits this long, cancelled if another card is entered — so moving
 *  between adjacent cards never flashes the base theme in the gap. */
const EXIT_HOLD_MS = 220
/** Floor between writes regardless of what the pointer did. */
const RATE_CAP_MS = 150
/** This many requests inside the window means scanning, not choosing. */
const SWEEP_COUNT = 3
const SWEEP_WINDOW_MS = 600
const SWEEP_COOLDOWN_MS = 500

/**
 * Drives the whole-screen theme preview behind the plan picker.
 *
 * The preview writes THE SAME attribute the committed theme uses
 * (`<html data-plan>`), so what you hover is byte-identical to what you get,
 * and reverting is one write of the committed value. No preview twin attribute,
 * no specificity ladder.
 *
 * Four separate guards, and none of them is a trailing debounce — a trailing
 * debounce makes a deliberate hover feel broken:
 *   - a 90ms leading enter gate
 *   - a 220ms exit hold
 *   - a hard 150ms rate cap
 *   - a sweep circuit-breaker that suppresses previews entirely for 500ms once
 *     three requests land inside 600ms. The gate handles the common case; the
 *     breaker handles someone dragging the pointer across all five cards.
 *
 * `baseline` is what reverting lands on. It must be the athlete's CURRENT
 * choice, not only the persisted plan: selecting a card applies its theme
 * immediately, and the commit button is a separate press, so reverting to the
 * persisted value would tear the theme back off the moment the pointer left the
 * card the athlete just picked.
 */
export function usePlanPreview(baseline: PlanSlug | null) {
  const [suppressed, setSuppressed] = useState(false)
  /** The slug currently ON the document. Mirrors `applied` into state so the UI
   *  can render off it — the background watermark follows this, not the hover,
   *  so it stays in lockstep with the palette through every gate and hold. */
  const [active, setActive] = useState<PlanSlug | null>(baseline)

  const enterTimer = useRef<number | undefined>(undefined)
  const exitTimer = useRef<number | undefined>(undefined)
  const animTimer = useRef<number | undefined>(undefined)
  const cooldownTimer = useRef<number | undefined>(undefined)
  const lastWrite = useRef(0)
  const recent = useRef<number[]>([])
  const applied = useRef<PlanSlug | null>(baseline)
  /** The slug the pointer is currently resting on, so the sweep breaker can
   *  restore it when the cooldown releases instead of leaving the screen on the
   *  baseline with no preview and no chips. */
  const hovered = useRef<PlanSlug | null>(null)

  const write = useCallback((slug: PlanSlug | null) => {
    if (applied.current === slug) return
    applied.current = slug
    setActive(slug)
    lastWrite.current = Date.now()

    const root = document.documentElement
    // The attribute gates the :root token transition, so it goes on FIRST —
    // set in the same task as the value and the crossfade never starts.
    root.dataset.planAnim = ''
    if (slug == null) delete root.dataset.plan
    else root.dataset.plan = slug

    window.clearTimeout(animTimer.current)
    // Comfortably past the longest declared duration (340ms for greek-god).
    animTimer.current = window.setTimeout(() => {
      delete document.documentElement.dataset.planAnim
    }, 420)
  }, [])

  /** Hover or scroll-centre. Debounced, rate-capped and breaker-gated. */
  const preview = useCallback(
    (slug: PlanSlug) => {
      window.clearTimeout(exitTimer.current)
      window.clearTimeout(enterTimer.current)
      hovered.current = slug
      if (suppressed) return

      const now = Date.now()
      recent.current = [...recent.current.filter((t) => now - t < SWEEP_WINDOW_MS), now]
      if (recent.current.length >= SWEEP_COUNT) {
        // Scanning: stop previewing, revert, and let the cards show their own
        // palette chips instead.
        recent.current = []
        setSuppressed(true)
        write(baseline)
        window.clearTimeout(cooldownTimer.current)
        cooldownTimer.current = window.setTimeout(() => {
          setSuppressed(false)
          // If the pointer came to rest during the cooldown, honour it — a
          // resting pointer with neither a preview nor chips reads as broken.
          if (hovered.current) write(hovered.current)
        }, SWEEP_COOLDOWN_MS)
        return
      }

      const wait = Math.max(ENTER_GATE_MS, RATE_CAP_MS - (now - lastWrite.current))
      enterTimer.current = window.setTimeout(() => write(slug), wait)
    },
    [baseline, suppressed, write],
  )

  /** Keyboard selection is already deliberate and slow, so it skips the gate. */
  const previewNow = useCallback(
    (slug: PlanSlug) => {
      window.clearTimeout(enterTimer.current)
      window.clearTimeout(exitTimer.current)
      hovered.current = slug
      write(slug)
    },
    [write],
  )

  const revert = useCallback(() => {
    window.clearTimeout(enterTimer.current)
    hovered.current = null
    exitTimer.current = window.setTimeout(() => write(baseline), EXIT_HOLD_MS)
  }, [baseline, write])

  // Leaving the picker must never strand a previewed theme on the document.
  useEffect(
    () => () => {
      window.clearTimeout(enterTimer.current)
      window.clearTimeout(exitTimer.current)
      window.clearTimeout(cooldownTimer.current)
      window.clearTimeout(animTimer.current)
      delete document.documentElement.dataset.planAnim
    },
    [],
  )

  return { preview, previewNow, revert, suppressed, active }
}
