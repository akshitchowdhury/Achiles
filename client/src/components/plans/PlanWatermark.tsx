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
 * Deliberately built out of the same decoded bitmap the cards use, so hovering a
 * card costs no extra request: useDecodedImage hits the browser cache.
 *
 * Reduced motion keeps the image and drops the crossfade — this is a background
 * texture, not movement, and a hard cut between two full-bleed images is the
 * more jarring option.
 */
export function PlanWatermark({ plan, slug, intensity = 'ambient' }: PlanWatermarkProps) {
  const reduce = useReducedMotion()
  const image = useDecodedImage(plan?.image_url)
  const visual = slug ? visualFor(slug) : null

  // No slug means no plan chosen yet — the base theme should look untouched.
  if (!slug) return null

  const hero = intensity === 'hero'
  const src = image.src ?? null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
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
              // The blur is doing two jobs. It reads as depth of field, which is
              // what a background silhouette should look like — and it hides
              // upscaling artifacts, which matters because the plan images are
              // sized for a 248px card and this stretches them across the whole
              // viewport (the narrowest source is 399px wide, a ~4.8x upscale).
              // Raise the source resolution and this can come down, not out.
              filter: `grayscale(${hero ? 0.45 : 0.7}) contrast(1.12) brightness(${hero ? 0.72 : 0.55}) blur(${hero ? 2 : 3}px)`,
              // Blur samples transparent pixels past the edges, which would show
              // as a soft vignette; scaling up slightly pushes that out of frame.
              transform: 'scale(1.04)',
              opacity: hero ? 0.3 : 0.13,
              maskImage:
                'radial-gradient(120% 95% at 78% 18%, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / 0.55) 45%, transparent 78%)',
              WebkitMaskImage:
                'radial-gradient(120% 95% at 78% 18%, rgb(0 0 0 / 1) 0%, rgb(0 0 0 / 0.55) 45%, transparent 78%)',
            }}
          />

          {/* Sinks the image back under the content. Uses the plan's own plane so
              it re-tints itself with the theme rather than being a fixed black. */}
          <div
            className="absolute inset-0"
            style={{
              background: hero
                ? 'linear-gradient(to right, var(--color-plane) 0%, rgb(0 0 0 / 0) 65%), linear-gradient(to top, var(--color-plane) 4%, rgb(0 0 0 / 0) 55%)'
                : 'linear-gradient(to right, var(--color-plane) 12%, rgb(0 0 0 / 0) 72%), linear-gradient(to top, var(--color-plane) 10%, rgb(0 0 0 / 0) 60%)',
            }}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
