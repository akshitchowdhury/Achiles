import { useMemo, useState } from 'react'
import { Droplets, Flame, Utensils } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { OptionGroup } from '../components/ui/OptionGroup'
import { StatTile } from '../components/ui/StatTile'
import { ErrorPanel, LoadingPanel } from '../components/ui/Feedback'
import { MacroSplitBar } from '../components/charts/MacroSplitBar'
import { apiErrorMessage } from '../api/client'
import { useCurrentUser } from '../hooks/useUser'
import { useSession } from '../store/session'
import {
  ACTIVITY_LEVELS,
  GOAL_META,
  goalForVerdict,
  macroTarget,
  tdee,
  waterTargetLitres,
} from '../lib/fitness'
import type { ActivityKey, Goal } from '../lib/fitness'
import { num, decimal } from '../lib/format'

const GOAL_OPTIONS = (Object.keys(GOAL_META) as Goal[]).map((goal) => ({
  value: goal,
  label: GOAL_META[goal].label,
  detail: GOAL_META[goal].detail,
}))

const MEALS_OPTIONS = [
  { value: '3', label: '3 meals', detail: 'Simple, larger plates' },
  { value: '4', label: '4 meals', detail: 'Balanced default' },
  { value: '5', label: '5 meals', detail: 'Smaller, more frequent' },
] as const

export function NutritionPage() {
  const { data: user, isPending, isError, error } = useCurrentUser()
  const storedWeight = useSession((s) => s.weight)

  const [activity, setActivity] = useState<ActivityKey>('moderate')
  const [goal, setGoal] = useState<Goal | null>(null)
  const [meals, setMeals] = useState<'3' | '4' | '5'>('4')

  // Default the goal from the stored verdict, but let the reader override it.
  const effectiveGoal = goal ?? (user ? goalForVerdict(user.specs.Verdict) : 'maintain')

  const factor = ACTIVITY_LEVELS.find((level) => level.key === activity)!.factor

  const target = useMemo(() => {
    if (!user) return null
    return macroTarget(tdee(user.specs.BMR, factor), effectiveGoal)
  }, [user, factor, effectiveGoal])

  if (isPending) return <LoadingPanel label="Loading your numbers" />
  if (isError) return <ErrorPanel message={apiErrorMessage(error)} />
  if (!target) return null

  const perMeal = Math.round(target.calories / Number(meals))

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Nutrition"
        title="Customise your intake"
        description="Everything here recalculates from your stored BMR. Change how you train and how hard you want to push, and the targets follow."
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Controls */}
        <Card className="space-y-6 lg:col-span-3">
          <OptionGroup
            legend="How much do you train?"
            value={activity}
            onChange={setActivity}
            options={ACTIVITY_LEVELS.map((level) => ({
              value: level.key,
              label: level.label,
              detail: level.detail,
            }))}
            columns={1}
          />

          <OptionGroup
            legend="What are you aiming for?"
            value={effectiveGoal}
            onChange={setGoal}
            options={GOAL_OPTIONS}
            columns={3}
          />

          <OptionGroup
            legend="Meals per day"
            value={meals}
            onChange={setMeals}
            options={MEALS_OPTIONS}
            columns={3}
          />
        </Card>

        {/* Output */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Daily target"
              hint={`${GOAL_META[effectiveGoal].detail} at a ${factor}× activity factor`}
            />
            <p className="text-ink text-4xl font-semibold tracking-tight">
              {num.format(target.calories)}
              <span className="text-ink-muted ml-2 text-base font-normal">kcal</span>
            </p>
            <p className="text-ink-muted mt-2 text-xs">
              Roughly {num.format(perMeal)} kcal across {meals} meals.
            </p>
          </Card>

          <Card>
            <CardHeader title="Macro split" hint="Estimated from your calorie target" />
            <MacroSplitBar target={target} />
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <StatTile
              label="Protein"
              value={num.format(target.protein)}
              unit="g"
              icon={Utensils}
            />
            <StatTile
              label="Water"
              value={storedWeight ? decimal(waterTargetLitres(storedWeight)) : '—'}
              unit={storedWeight ? 'L' : undefined}
              icon={Droplets}
              hint={storedWeight ? 'Estimated' : 'Needs weight'}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="How these numbers are built"
          hint="So you can sanity-check them rather than trust them blindly"
        />
        <ul className="text-ink-dim space-y-2 text-sm">
          <li className="flex gap-2.5">
            <Flame className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Your BMR of {num.format(user.specs.BMR)} kcal comes from the server, multiplied by{' '}
              {factor}× to estimate maintenance.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Utensils className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Protein and carbs are counted at 4 kcal per gram, fat at 9 — which is why the bar
              splits by calories, not grams.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Droplets className="text-ink-muted mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Water is 35 ml per kilogram of bodyweight.</span>
          </li>
        </ul>
      </Card>
    </div>
  )
}
