import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { ErrorPanel, LoadingPanel } from '../components/ui/Feedback'
import { Wordmark } from '../components/layout/Logo'
import { PlanUser } from '../components/layout/PlanUser'
import { PlanPicker } from '../components/plans/PlanPicker'
import { PlanWatermark } from '../components/plans/PlanWatermark'
import { apiErrorMessage } from '../api/client'
import { usePlans } from '../hooks/usePlans'
import { PLAN_LAYOUTS } from '../theme/registry'
import { useSession } from '../store/session'
import type { PlanSlug } from '../types'

const HEADING_ID = 'plan-picker-heading'

/**
 * Step two of onboarding: pick a training plan.
 *
 * This is not only a data choice — the plan decides the app's entire palette,
 * geometry, typography and layout from here on, so the screen previews the
 * theme live as you move across the cards.
 *
 * It renders OUTSIDE AppShell on purpose: the picker must not sit inside a plan
 * shell it is in the middle of choosing.
 */
export function SelectPlanPage() {
  const userId = useSession((s) => s.userId)
  const committed = useSession((s) => s.planSlug)
  const choosePlan = useSession((s) => s.choosePlan)
  const navigate = useNavigate()

  const { data: plans, isPending, isError, error, refetch } = usePlans()
  const [selected, setSelected] = useState<PlanSlug | null>(committed)
  // What the document is currently themed as — hover preview included. Driven by
  // the picker rather than by `selected` so the watermark and the palette change
  // on the same tick.
  const [active, setActive] = useState<PlanSlug | null>(committed)
  const activePlan = plans?.find((plan) => plan.slug === active)

  // Same guard AppShell applies — there is no plan to choose without a profile.
  if (userId == null) return <Navigate to="/welcome" replace />

  function commit() {
    if (selected == null) return
    choosePlan(selected)
    navigate('/', { replace: true })
  }

  return (
    <div className="bg-plane relative isolate flex min-h-svh flex-col">
      {/* Full-bleed silhouette of whichever plan is being previewed. This is what
          makes the theme swap legible: four of the five palettes are dark, so a
          plane-colour change alone barely reads. */}
      <PlanWatermark plan={activePlan} slug={active} intensity="hero" />

      {/* Sign-out lives here because this screen is otherwise a trap: an
          athlete with no plan is bounced here by AppShell, and if /getPlans is
          down or the catalogue is unseeded there is no plan to pick and no way
          back out. */}
      <header className="border-hairline relative z-10 flex h-16 shrink-0 items-center justify-between border-b px-5 sm:px-8">
        <Wordmark />
        <PlanUser compact />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-10 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-ink-muted tracking-label text-xs font-medium uppercase">Step 2 of 2</p>
          <h1
            id={HEADING_ID}
            className="text-ink font-display mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Choose how you train
          </h1>
          <p className="text-ink-dim mt-3 text-sm">
            Each plan brings its own programme — and its own look. Hover a card to
            see it take over the screen; the one you pick stays with you across the
            whole app. You can tell it apart at a glance, which is the point.
          </p>
        </div>

        <div className="mt-8">
          {isPending && <LoadingPanel label="Loading training plans" />}

          {isError && (
            <ErrorPanel
              title="Could not load the training plans"
              message={apiErrorMessage(error)}
              action={
                <Button size="sm" variant="secondary" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            />
          )}

          {plans && plans.length === 0 && (
            <ErrorPanel
              title="No training plans yet"
              message="The catalogue is empty. Seed it by POSTing the plan list to /addPlans, then reload this page."
              action={
                <Button size="sm" variant="secondary" onClick={() => refetch()}>
                  Check again
                </Button>
              }
            />
          )}

          {plans && plans.length > 0 && (
            <>
              <PlanPicker
                plans={plans}
                committed={committed}
                selected={selected}
                onSelect={setSelected}
                labelledBy={HEADING_ID}
                onActiveChange={setActive}
              />

              <div className="border-hairline mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
                <p className="text-ink-muted max-w-sm text-xs">
                  {selected
                    ? PLAN_LAYOUTS[selected].tagline
                    : 'Pick a plan to continue. You can change it later from your profile.'}
                </p>
                <Button size="lg" onClick={commit} disabled={selected == null}>
                  {selected ? `Train as ${PLAN_LAYOUTS[selected].label}` : 'Choose a plan'}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Honest about a real limitation: the plan lives in this browser only,
            because the users table has no column for it yet. */}
        <p className="text-ink-muted mt-8 text-xs">
          Your plan is saved on this device. Clearing site data or signing in
          elsewhere will bring you back here.
        </p>
      </main>
    </div>
  )
}
