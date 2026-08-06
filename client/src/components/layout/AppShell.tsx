import { Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RouteTransition } from './RouteTransition'
import { LoadingPanel } from '../ui/Feedback'
import { usePlanTheme } from '../../theme/usePlanTheme'
import { useSession } from '../../store/session'

/**
 * Two guards, the theme binding, and the athlete's chosen shell.
 *
 * No user id means onboarding never started; no plan means it never finished.
 * The second guard is what brings back an athlete who signed up before plans
 * existed, or who cleared their storage.
 *
 * There is no drawer state here any more: none of the five layouts uses one.
 * Two go to bottom rails under lg, the other three have no rail to hide.
 */
export function AppShell() {
  const userId = useSession((s) => s.userId)
  const planSlug = useSession((s) => s.planSlug)
  const location = useLocation()

  // Writes <html data-plan>, which every token override keys off, and hands
  // back the row describing this plan's layout.
  const { shell: Shell, motion } = usePlanTheme()

  if (userId == null) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  }

  if (planSlug == null) {
    return <Navigate to="/select-plan" replace />
  }

  return (
    <Suspense
      fallback={
        <div className="bg-plane min-h-svh">
          <LoadingPanel label="Preparing your training space" />
        </div>
      }
    >
      <Shell>
        <RouteTransition motionId={motion}>
          <Outlet />
        </RouteTransition>
      </Shell>
    </Suspense>
  )
}
