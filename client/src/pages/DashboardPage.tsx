import { Link } from 'react-router-dom'
import { ArrowUpRight, Droplets, Flame, Gauge, Ruler, Sparkles, WeightIcon } from 'lucide-react'
import { Card, CardHeader } from '../components/ui/Card'
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
import {
  ACTIVITY_LEVELS,
  GOAL_META,
  goalForVerdict,
  macroTarget,
  tdee,
  verdictTone,
} from '../lib/fitness'
import { num, decimal } from '../lib/format'

export function DashboardPage() {
  const { data: user, isPending, isError, error, refetch } = useCurrentUser()
  const storedWeight = useSession((s) => s.weight)

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">
            Your baseline
          </p>
          <h1 className="text-ink mt-1 text-3xl font-semibold tracking-tight">
            {user.name.split(' ')[0]}&rsquo;s readout
          </h1>
        </div>
        <StatusBadge tone={tone} label={specs.Verdict} />
      </header>

      {/* Hero figure — exactly one per view */}
      <Card className="hatch">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-ink-muted text-xs font-medium">
              Daily maintenance &middot; {moderate.label.toLowerCase()} training
            </p>
            <p className="text-ink mt-1.5 text-5xl font-semibold tracking-tight">
              {num.format(maintenance)}
              <span className="text-ink-muted ml-2 text-base font-normal">kcal</span>
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
            Get my plan
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </Card>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="BMI" value={decimal(specs.BMI)} icon={Gauge} hint={specs.Verdict} />
        <StatTile
          label="BMR"
          value={num.format(specs.BMR)}
          unit="kcal"
          icon={Flame}
          hint="At complete rest"
        />
        <StatTile label="Height" value={num.format(user.height_cm)} unit="cm" icon={Ruler} />
        <StatTile
          label="Weight (kg)"
          value={user.weight}
          unit={storedWeight ? 'kg' : undefined}
          icon={WeightIcon}
          hint={`Weighed on empty stomach in morning`}
        />
        <StatTile
          label="Water Intake (L)"
          value={user.specs.WaterIntake}
          unit={storedWeight ? 'L' : undefined}
          icon={Droplets}
          hint={storedWeight ? '35 ml per kg — estimated' : 'Needs your weight'}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where you sit" hint="BMI against the WHO band scale" />
          <BmiScale bmi={specs.BMI} tone={tone} />
        </Card>

        <Card>
          <CardHeader
            title="Bodyweight vs target"
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
            title="Maintenance calories by activity"
            hint="Estimated — your BMR scaled by standard activity factors"
          />
          <CalorieByActivityChart bmr={specs.BMR} />
        </Card>

        <Card>
          <CardHeader
            title={`Macro split — ${GOAL_META[goal].label.toLowerCase()}`}
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
              <Sparkles className="text-volt size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-ink text-sm font-semibold">Ready for the detail?</p>
              <p className="text-ink-dim mt-0.5 text-sm">
                Turn these numbers into a structured week of training and meals.
              </p>
            </div>
          </div>
          <Link
            to="/coach"
            className="bg-volt text-plane hover:bg-volt-hi inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors"
          >
            Open AI panel
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </Card>
    </div>
  )
}
