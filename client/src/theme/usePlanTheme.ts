import { useEffect } from 'react'
import { useSession } from '../store/session'
import { layoutFor, type PlanLayout } from './registry'

/** Kept in sync with the map inlined in index.html — see the note there. */
export const THEME_COLOR: Record<string, string> = {
  spartan: '#17120d',
  'greek-god': '#e9e3d3',
  superhero: '#080d14',
  athlete: '#101114',
  manga: '#0d0a12',
}

/**
 * Mirrors the chosen plan onto <html data-plan>, which is what every token
 * override in theme/plan-themes.css keys off.
 *
 * This RE-SYNCS; it does not initiate. The blocking script in index.html has
 * already stamped the attribute from localStorage before first paint, so on a
 * normal load this writes the value that is already there. That is deliberate —
 * the effect exists to catch the transitions the bootstrap cannot see: choosing
 * a plan, signing out, or a second tab changing it.
 *
 * Returns the layout row so a caller can pick its shell in the same breath.
 */
export function usePlanTheme(): PlanLayout {
  const planSlug = useSession((s) => s.planSlug)

  useEffect(() => {
    const root = document.documentElement

    if (planSlug == null) {
      // No plan yet: drop the attribute so the base @theme block applies,
      // rather than leaving a stale plan's colours on the picker.
      delete root.dataset.plan
    } else {
      root.dataset.plan = planSlug
    }

    // Address-bar tint on mobile. Read back off the cascade rather than from
    // the map above so the two can never disagree once CSS has parsed.
    const plane = getComputedStyle(root).getPropertyValue('--color-plane').trim()
    if (plane) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', plane)
    }
  }, [planSlug])

  return layoutFor(planSlug)
}
