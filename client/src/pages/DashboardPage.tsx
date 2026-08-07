import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
import { PageHeader } from '../components/layout/PageHeader'
import { StatTile } from '../components/ui/StatTile'
import { StatusBadge } from '../components/ui/StatusBadge'
import { Button } from '../components/ui/Button'
import { ErrorPanel, LoadingPanel } from '../components/ui/Feedback'
import { BmiScale } from '../components/charts/BmiScale'
import { CalorieByActivityChart } from '../components/charts/CalorieByActivityChart'
import { MacroSplitBar } from '../components/charts/MacroSplitBar'
import { WeightRangeMeter } from '../components/charts/WeightRangeMeter'
import { apiErrorMessage } from '../api/client'
import { useCurrentUser } from '../hooks/useUser'
import { useSession } from '../store/session'
import { motifFor } from '../theme/planMotif'
import {
  ACTIVITY_LEVELS,
  GOAL_META,
  goalForVerdict,
  macroTarget,
  tdee,
  verdictTone,
} from '../lib/fitness'
import { num, decimal } from '../lib/format'

/**
 * The baseline readout — one page, five templates.
 *
 * The structure is fixed (masthead, one hero figure, a five-tile KPI row, four
 * charts, one nudge) because it is the right structure for the data. What the
 * plan changes is everything wrapped around it: the words, the icons, the face
 * the figures are set in, and the ornament on the hero panel. Those come from
 * motifFor() and from the .plan-* classes in theme/plan-shells.css, so adding a
 * sixth plan means a row in planMotif.ts and a CSS block — not a fork of this
 * file.
 *
 * The flavour never reaches the data. A Spartan reads "Rest burn" over the same
 * BMR, in the same kcal, with the same "At complete rest" hint underneath.
 */
export function DashboardPage() {
  const { data: user, isPending, isError, error, refetch } = useCurrentUser()
  const storedWeight = useSession((s) => s.weight)
  const planSlug = useSession((s) => s.planSlug)
  const { copy, icons } = motifFor(planSlug)

  if (isPending) return <LoadingPanel label="Loading your baseline" />

  if (isError) {
    return (
      <ErrorPanel
        title="Could not load your profile"
        message={apiErrorMessage(error)}
        action={
          <Button size="sm" variant="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  const { specs } = user
  const tone = verdictTone(specs.Verdict)
  const goal = goalForVerdict(specs.Verdict)

  // "Moderate" is the reference point the headline number uses; the chart
  // below shows what every other activity level would mean.
  const moderate = ACTIVITY_LEVELS.find((level) => level.key === 'moderate')!
  const maintenance = tdee(specs.BMR, moderate.factor)
  const target = macroTarget(maintenance, goal)

  const HeroIcon = icons.hero
  const CoachIcon = icons.coach

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title(user.name.split(' ')[0])}
        action={<StatusBadge tone={tone} label={specs.Verdict} />}
      />

      {/* Hero figure — exactly one per view. .plan-hero is what carries the
          per-plan ornament: a meander lintel, a scroll's rolled edges, HUD
          brackets, a broadcast wedge, a screentone corner. It also carries the
          panel's texture, which is why the shared `hatch` utility is NOT on
          this card — see the note on .plan-hero in plan-shells.css. */}
      <Card className="plan-hero">
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="plan-eyebrow text-ink-muted flex items-center gap-2">
              <HeroIcon className="text-volt size-3.5" aria-hidden="true" />
              {copy.heroLabel} &middot; {copy.tempo}
            </p>
            <p className="plan-figure text-ink mt-2">
              {num.format(maintenance)}
              <span className="text-ink-muted font-sans ml-2 text-base font-normal">kcal</span>
            </p>
            <p className="text-ink-dim mt-2 max-w-md text-sm">
              Estimated from a BMR of {num.format(specs.BMR)} kcal at a{' '}
              {moderate.factor}× activity factor. Your{' '}
              <span className="text-ink font-medium">{GOAL_META[goal].label.toLowerCase()}</span>{' '}
              target is {num.format(target.calories)} kcal.
            </p>
          </div>
          <Link
            to="/coach"
            className="bg-raised text-ink border-hairline-strong hover:border-volt/50 hover:text-volt inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs transition-colors"
          >
            {copy.heroCta}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label={copy.stats.bmi}
          value={decimal(specs.BMI)}
          icon={icons.bmi}
          hint={specs.Verdict}
        />
        <StatTile
          label={copy.stats.bmr}
          value={num.format(specs.BMR)}
          unit="kcal"
          icon={icons.bmr}
          hint="At complete rest"
        />
        <StatTile
          label={copy.stats.height}
          value={num.format(user.height_cm)}
          unit="cm"
          icon={icons.height}
        />
        <StatTile
          label={copy.stats.weight}
          value={user.weight}
          unit={storedWeight ? 'kg' : undefined}
          icon={icons.weight}
          hint="Weighed on empty stomach in morning"
        />
        <StatTile
          label={copy.stats.water}
          value={user.specs.WaterIntake}
          unit={storedWeight ? 'L' : undefined}
          icon={icons.water}
          hint={storedWeight ? '35 ml per kg — estimated' : 'Needs your weight'}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={copy.charts.band} hint="BMI against the WHO band scale" />
          <BmiScale bmi={specs.BMI} tone={tone} />
        </Card>

        <Card>
          <CardHeader
            title={copy.charts.range}
            hint={storedWeight ? 'Healthy range for your height' : undefined}
          />
          {storedWeight ? (
            <WeightRangeMeter weightKg={storedWeight} heightCm={user.height_cm} />
          ) : (
            <p className="text-ink-muted py-6 text-sm">
              Weight isn&rsquo;t returned by the profile endpoint. Sign up again as a
              guest to record it on this device.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title={copy.charts.burn}
            hint="Estimated — your BMR scaled by standard activity factors"
          />
          <CalorieByActivityChart bmr={specs.BMR} />
        </Card>

        <Card>
          <CardHeader
            title={`${copy.charts.macros} — ${GOAL_META[goal].label.toLowerCase()}`}
            hint={GOAL_META[goal].detail}
          />
          <MacroSplitBar target={target} />
        </Card>
      </div>

      {/* Coach nudge */}
      <Card className="border-volt/25">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="bg-volt/15 flex size-9 shrink-0 items-center justify-center rounded-xl">
              <CoachIcon className="text-volt size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="plan-card-title text-ink">{copy.nudge.title}</p>
              <p className="text-ink-dim mt-1 text-sm">{copy.nudge.body}</p>
            </div>
          </div>
          <Link
            to="/coach"
            className="bg-volt text-on-accent hover:bg-volt-hi inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors"
          >
            {copy.nudge.cta}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </div>
  )
}
