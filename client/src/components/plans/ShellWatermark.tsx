import { PlanWatermark } from './PlanWatermark'
import { usePlans } from '../../hooks/usePlans'
import { useSession } from '../../store/session'

/**
 * The committed plan's silhouette, sitting quietly behind the whole app.
 *
 * Reads the catalogue rather than caching an image URL in the session store: the
 * plans query is already warm from the picker, has a 5-minute staleTime, and this
 * way there is no denormalised URL to go stale when the bucket key changes. If
 * the query has not resolved, or the image 404s, nothing renders — the shell's
 * gradient background is the design, and this is a layer on top of it.
 */
export function ShellWatermark() {
  const planSlug = useSession((s) => s.planSlug)
  const { data: plans } = usePlans()
  const plan = plans?.find((p) => p.slug === planSlug)

  return <PlanWatermark plan={plan} slug={planSlug} intensity="ambient" />
}
