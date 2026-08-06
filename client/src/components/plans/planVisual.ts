import { Crown, Flame, Shield, Swords, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PlanSlug } from '../../types'

/**
 * What a card shows when there is no photo.
 *
 * The S3 bucket may be private, the key may be missing, a presigned URL may
 * have expired — and `background-image` reports none of it. So every plan needs
 * art that always works.
 *
 * The gradients are literal hex, not tokens, and that is deliberate: they are
 * the plan's OWN colours shown on the picker while a different theme is active,
 * so they must not follow the current theme. They also stay out of the token
 * crossfade's repaint for the same reason the shading layer does.
 *
 * A CSS gradient goes through the identical facet strip maths as a photo, so
 * the fallback stays cylindrical rather than flattening to a coloured box.
 */
export interface PlanVisual {
  /** Painted on the facets in place of the photo. */
  gradient: string
  /** Shown on the flat content plane, so it is never warped. */
  crest: LucideIcon
  /** Palette chips, shown when the sweep circuit-breaker suppresses previews. */
  chips: [string, string, string]
}

export const PLAN_VISUALS: Record<PlanSlug, PlanVisual> = {
  spartan: {
    gradient:
      'radial-gradient(120% 90% at 50% 0%, #4a3a24 0%, #2a221c 45%, #12100e 100%), linear-gradient(160deg, #8b1e24 0%, transparent 55%)',
    crest: Swords,
    chips: ['#f0c455', '#8b1e24', '#6c4a2d'],
  },
  'greek-god': {
    gradient:
      'radial-gradient(110% 85% at 50% 0%, #ffffff 0%, #ece7db 40%, #cfc7b4 100%), linear-gradient(155deg, rgba(212,175,55,0.55) 0%, transparent 60%)',
    crest: Crown,
    chips: ['#5b3a82', '#d4af37', '#6da9e4'],
  },
  superhero: {
    gradient:
      'radial-gradient(120% 90% at 50% 0%, #2a3340 0%, #151a22 45%, #0b0d10 100%), linear-gradient(150deg, rgba(74,146,255,0.5) 0%, transparent 58%)',
    crest: Shield,
    chips: ['#4a92ff', '#d4af37', '#2e8b57'],
  },
  athlete: {
    gradient:
      'radial-gradient(120% 90% at 50% 0%, #2b2d31 0%, #1a1c20 45%, #0e0f11 100%), linear-gradient(105deg, rgba(51,249,138,0.42) 0%, transparent 52%), linear-gradient(285deg, rgba(255,122,0,0.34) 0%, transparent 48%)',
    crest: Zap,
    chips: ['#33f98a', '#ff7a00', '#2f80ed'],
  },
  manga: {
    gradient:
      'radial-gradient(120% 90% at 50% 0%, #2a2a2d 0%, #17171a 45%, #0c0c0d 100%), linear-gradient(148deg, rgba(91,42,134,0.62) 0%, transparent 56%), linear-gradient(300deg, rgba(139,0,0,0.5) 0%, transparent 50%)',
    crest: Flame,
    chips: ['#45d5e8', '#5b2a86', '#8b0000'],
  },
}

export function visualFor(slug: string): PlanVisual {
  return PLAN_VISUALS[slug as PlanSlug] ?? PLAN_VISUALS.athlete
}
