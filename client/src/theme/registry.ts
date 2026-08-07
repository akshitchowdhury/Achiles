import { lazy, type ComponentType } from 'react'
import type { ShellProps } from '../components/layout/shells/types'
import { isPlanSlug, type PlanSlug } from '../types'

/**
 * The one table that maps a training plan to how the app looks and moves.
 *
 * Two independent lookups share the slug as their key:
 *   slug → data-plan attribute → token values (theme/plan-themes.css)
 *   slug → LayoutId            → shell component (layout/shells/*)
 *
 * Keeping colour and structure separate is what makes a sixth plan additive:
 * one CSS block, one shell file, one row here — and nothing under pages/ or
 * components/ui/ is touched.
 */

/** Shell identities. Named after the architecture, not the plan, because a
 *  future plan could legitimately reuse one. */
export type LayoutId = 'stoa' | 'peristyle' | 'command-deck' | 'broadcast' | 'panel-grid'

/** Route-enter animation identities, resolved in RouteTransition. */
export type MotionId = 'ember' | 'ascend' | 'scan' | 'streak' | 'glitch'

/**
 * Shells are lazy so only the athlete's own layout ships in the initial chunk —
 * nobody downloads five app frames to use one. AppShell provides the Suspense
 * boundary.
 */
const SHELLS: Record<LayoutId, ComponentType<ShellProps>> = {
  stoa: lazy(() =>
    import('../components/layout/shells/StoaShell').then((m) => ({ default: m.StoaShell })),
  ),
  peristyle: lazy(() =>
    import('../components/layout/shells/PeristyleShell').then((m) => ({
      default: m.PeristyleShell,
    })),
  ),
  'command-deck': lazy(() =>
    import('../components/layout/shells/CommandDeckShell').then((m) => ({
      default: m.CommandDeckShell,
    })),
  ),
  broadcast: lazy(() =>
    import('../components/layout/shells/BroadcastShell').then((m) => ({
      default: m.BroadcastShell,
    })),
  ),
  'panel-grid': lazy(() =>
    import('../components/layout/shells/PanelGridShell').then((m) => ({
      default: m.PanelGridShell,
    })),
  ),
}

export interface PlanLayout {
  layout: LayoutId
  shell: ComponentType<ShellProps>
  motion: MotionId
  /** Mirrors --ui-color-scheme in the CSS block. JS reads it for the picker's
   *  contrast decisions; the browser reads the CSS one. */
  scheme: 'dark' | 'light'
  /** Shown in shell chrome — the Stoa architrave, the HUD strip. */
  label: string
  /** One line of plan character, used as the picker's caption. */
  tagline: string
}

export const PLAN_LAYOUTS: Record<PlanSlug, PlanLayout> = {
  spartan: {
    layout: 'stoa',
    shell: SHELLS['stoa'],
    motion: 'ember',
    scheme: 'dark',
    label: 'Spartan',
    tagline: 'Discipline over motivation. Bronze, stone, and work that does not negotiate.',
  },
  'greek-god': {
    layout: 'peristyle',
    shell: SHELLS['peristyle'],
    motion: 'ascend',
    scheme: 'light',
    label: 'Greek God',
    tagline: 'Proportion as the goal. Marble, gold, and symmetry you can measure.',
  },
  superhero: {
    layout: 'command-deck',
    shell: SHELLS['command-deck'],
    motion: 'scan',
    scheme: 'dark',
    label: 'Vigilante',
    tagline: 'Precision over spectacle. A command deck for the work nobody sees.',
  },
  athlete: {
    layout: 'broadcast',
    shell: SHELLS['broadcast'],
    motion: 'streak',
    scheme: 'dark',
    label: 'Athlete',
    tagline: 'Every session is a fixture. Numbers on the board, under the lights.',
  },
  manga: {
    layout: 'panel-grid',
    shell: SHELLS['panel-grid'],
    motion: 'glitch',
    scheme: 'dark',
    label: 'Manga',
    tagline: 'Training as an awakening. Cursed energy, moonlit steel, one seal at a time.',
  },
}

/**
 * Fallback when no plan is chosen or a stored slug is no longer recognised.
 * 'athlete' is deliberate: its palette is the closest to the original neon-on-
 * black system, so an unthemed screen looks intentional rather than broken.
 */
export const DEFAULT_SLUG: PlanSlug = 'athlete'

/**
 * Total by construction. A slug persisted by an older build — or a plan since
 * removed from PLAN_SLUGS — would otherwise return undefined here, and AppShell
 * would destructure `shell` off it and blank the whole app.
 */
export function layoutFor(slug: PlanSlug | null | undefined): PlanLayout {
  return (isPlanSlug(slug) && PLAN_LAYOUTS[slug]) || PLAN_LAYOUTS[DEFAULT_SLUG]
}
