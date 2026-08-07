import { motion, useReducedMotion } from 'motion/react'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { MotionId } from '../../theme/registry'

interface Variant {
  initial: Record<string, string | number>
  animate: Record<string, string | number>
  transition: Record<string, unknown>
}

/**
 * Each plan's signature route-enter animation. Deliberately small — a shell's
 * character comes from its structure, and a long entrance on every navigation
 * turns into a tax you pay all day.
 */
const MOTION: Record<MotionId, Variant> = {
  // spartan: rises and settles, like something heavy being set down.
  ember: {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.34, ease: [0.16, 1, 0.3, 1] },
  },
  // greek-god: ascends into place, weightless.
  ascend: {
    initial: { opacity: 0, y: 22, scale: 0.995 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
  },
  // superhero: a HUD resolving — clipped in from the top like a scan line.
  scan: {
    initial: { opacity: 0, clipPath: 'inset(0 0 100% 0)' },
    animate: { opacity: 1, clipPath: 'inset(0 0 0% 0)' },
    transition: { duration: 0.36, ease: [0.4, 0, 0.2, 1] },
  },
  // athlete: enters at speed from the side, with motion blur implied by the
  // horizontal offset rather than an actual filter (filters are expensive and
  // would rasterize the whole subtree).
  streak: {
    initial: { opacity: 0, x: 26 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.28, ease: [0.2, 0.9, 0.1, 1] },
  },
  // manga: a panel snapping into frame.
  glitch: {
    initial: { opacity: 0, x: -10, skewX: 1.5 },
    animate: { opacity: 1, x: 0, skewX: 0 },
    transition: { duration: 0.24, ease: [0.36, 0, 0.1, 1] },
  },
}

/** Opacity only. No transform, no clip, no skew — nothing that reads as motion. */
const REDUCED: Variant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.16 },
}

interface RouteTransitionProps {
  motionId: MotionId
  children: ReactNode
}

export function RouteTransition({ motionId, children }: RouteTransitionProps) {
  const reduce = useReducedMotion()
  const { pathname } = useLocation()
  const variant = reduce ? REDUCED : MOTION[motionId]

  return (
    <motion.div
      // Keying on the path is what makes this fire per navigation rather than
      // once per mount.
      key={pathname}
      initial={variant.initial}
      animate={variant.animate}
      transition={variant.transition}
    >
      {children}
    </motion.div>
  )
}
