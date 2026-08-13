import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useDecodedImage } from '../../hooks/useDecodedImage'
import { visualFor } from './planVisual'
import type { PlanSlug, TrainingPlan } from '../../types'

interface PlanWatermarkProps {
  plan: TrainingPlan | undefined
  slug: PlanSlug | null
  /** 'hero' fills the viewport behind the picker; 'ambient' is the quiet version
   *  the app shells sit on all day. */
  intensity?: 'hero' | 'ambient'
}

/**
 * The plan's own image, blown up huge and faded into the background.
 *
 * It does the job four near-identical dark palettes cannot: makes a theme change
 * unmistakable. The plane colours differ by hue, but at these lightness levels
 * that alone reads as "did anything happen?" — a silhouette swapping behind the
 * content does not.
 *
 * Prefers the plan's dedicated watermark art and falls back to its cover. The
 * two are different pictures on purpose: the cover is a portrait crop that has
 * to read at 248px on a card, and stretching that across a 1920px viewport was
 * the reason this layer needed so much blur to look deliberate. Rows written
 * before the server grew a watermark_key have none, so the fallback is a
 * normal state rather than an error path.
 *
 * Reduced motion keeps the image and drops the crossfade — this is a background
 * texture, not movement, and a hard cut between two full-bleed images is the
 * more jarring option.
 */
export function PlanWatermark({ plan, slug, intensity = 'ambient' }: PlanWatermarkProps) {
  const reduce = useReducedMotion()
  // Falling back inside the hook rather than after it: passing the cover URL
  // straight through means one request either way, and the `failed` path still
  // lands on the plan's gradient.
  const backdrop = plan?.watermark_url || plan?.image_url
  const image = useDecodedImage(backdrop)
  const visual = slug ? visualFor(slug) : null

  // No slug means no plan chosen yet — the base theme should look untouched.
  if (!slug) return null

  const hero = intensity === 'hero'
  const src = image.src ?? null
  // Watermark art is authored at full-bleed size; a cover is not. The blur is
  // hiding an upscale in the fallback case only, so it comes almost all the way
  // off when the real backdrop loaded.
  const dedicated = src != null && plan?.watermark_url != null && src === plan.watermark_url
  const blurPx = dedicated ? (hero ? 0 : 1) : hero ? 2 : 3

  return (
    // -z-10 is load-bearing, not decoration. This root is `fixed`, so it is a
    // positioned box with z-index:auto — which paints ABOVE non-positioned
    // block content in the same stacking context. `main` and the cards inside
    // it are static, so without this the scrim below was drawing its opaque
    // plane over the bottom of every page instead of under it.
    //
    // Negative rather than a low positive: every shell root carries `isolate`,
    // which pins the negative index inside the shell instead of letting it
    // drop behind .plan-bg entirely — the same trick the manga ::before uses.
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          // Keyed on the slug so a plan change crossfades rather than snapping
          // the bitmap out from under the mask.
          key={slug}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : hero ? 0.42 : 0.6, ease: [0.33, 1, 0.68, 1] }}
          className="absolute inset-0"
        >
          {/* The silhouette. Desaturated and dimmed rather than tinted, so it
              reads as texture under the palette instead of fighting it, and
              masked to nothing at the edges so no hard rectangle shows. */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: src ? `url("${src}")` : (visual?.gradient ?? undefined),
              backgroundSize: 'cover',
              // Right of centre and high: keeps the subject clear of the text
              // column on the left in every shell.
              backgroundPosition: hero ? '75% 28%' : '68% 22%',
              backgroundRepeat: 'no-repeat',
              // The blur was doing two jobs: depth of field, which is what a
              // background silhouette should look like, and hiding the ~4.8x
              // upscale of a card-sized cover. Dedicated watermark art removes
              // the second job, so `blurPx` above drops to 0–1 and the artwork
              // is actually legible instead of being a coloured haze.
              filter: `grayscale(${hero ? 0.45 : 0.7}) contrast(1.12) brightness(${hero ? 0.72 : 1.55}) blur(${blurPx}px)`,
              // Blur samples transparent pixels past the edges, which would show
              // as a soft vignette; scaling up slightly pushes that out of frame.
              transform: 'scale(1.04)',
              opacity: hero ? 0.3 : 0.13,
              maskImage:
                'radial-gradient(120% 95% at 78% 18%, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / 0.55) 145%, transparent 178%)',
              // Must stay byte-identical to maskImage above. Chrome supports
              // both properties and takes whichever is declared last, which is
              // this one — so a stop edited in only one of the pair silently
              // does nothing.
              WebkitMaskImage:
                'radial-gradient(120% 95% at 78% 18%, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / 0.55) 145%, transparent 178%)',
            }}
          />

          {/* Sinks the image back under the content. Uses the plan's own plane so
              it re-tints itself with the theme rather than being a fixed black.

              The ambient bottom fade is kept short on purpose. This layer is
              fixed to the viewport, so a tall `to top` ramp is not a vignette
              at the end of the page — it is a permanent band across the lower
              third of every screen, sitting exactly where the last card of a
              page lands. 3% solid into nothing by 38% reads as depth without
              swallowing anything below the fold. */}
          <div
            className="absolute inset-0"
            style={{
              background: hero
                ? 'linear-gradient(to right, var(--color-plane) 0%, rgb(0 0 0 / 0) 65%), linear-gradient(to top, var(--color-plane) 4%, rgb(0 0 0 / 0) 55%)'
                : 'linear-gradient(to right, var(--color-plane) 8%, rgb(0 0 0 / 0) 60%), linear-gradient(to top, var(--color-plane) 3%, rgb(0 0 0 / 0) 38%)',
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
