import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Compass, Download, RotateCcw, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorPanel } from '../components/ui/Feedback'
import { StatusBadge } from '../components/ui/StatusBadge'
import { apiErrorMessage } from '../api/client'
// import { useCoachPlan } from '../hooks/useUser'   // ← restore with useMockCoachPlan below
import { useCurrentUser, usePlanDoc } from '../hooks/useUser'
import { verdictTone } from '../lib/fitness'
import { num, decimal } from '../lib/format'

export function CoachPage() {
  const { data: user } = useCurrentUser()
  // TEMPORARY: the coach endpoint is disabled — this serves canned markdown.
  const plan = useMockCoachPlan()
  // The .docx call is real: whatever markdown is on screen is what gets sent.
  const doc = usePlanDoc()

  const runGuide = () => {
    doc.reset()
    plan.mutate()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI panel"
        title="Guide me"
        description="Your stored metrics are sent to the coach, which returns a structured nutrition and training plan built around them."
        action={
          <Button onClick={runGuide} loading={plan.isPending} size="lg" className="shrink-0">
            {!plan.isPending && <Compass className="size-4" aria-hidden="true" />}
            {plan.isPending ? 'Writing your plan' : plan.data ? 'Regenerate' : 'Guide me'}
          </Button>
        }
      />

      {/* What gets sent — no hidden inputs. */}
      {user && (
        <Card>
          <CardHeader
            title="What the coach sees"
            hint="Exactly the fields the server puts in the prompt"
            action={<StatusBadge tone={verdictTone(user.specs.Verdict)} label={user.specs.Verdict} />}
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {[
              { label: 'Age', value: `${user.age}` },
              { label: 'Height', value: `${num.format(user.height_cm)} cm` },
              { label: 'BMI', value: decimal(user.specs.BMI) },
              { label: 'BMR', value: `${num.format(user.specs.BMR)} kcal` },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-ink-muted text-xs">{row.label}</dt>
                <dd className="text-ink mt-0.5 text-sm font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {plan.isError && (
        <ErrorPanel
          title="The coach could not answer"
          message={apiErrorMessage(plan.error)}
          action={
            <Button size="sm" variant="secondary" onClick={runGuide}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Try again
            </Button>
          }
        />
      )}

      {plan.isPending && <PlanSkeleton />}

      {plan.data && !plan.isPending && (
        <Card>
          <CardHeader
            title="Your plan"
            hint="Generated from your metrics — review before acting on it"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => doc.mutate(plan.data as string)}
                loading={doc.isPending}
                title="Download as .docx"
                aria-label="Download this plan as a Word document"
                className="shrink-0"
              >
                {!doc.isPending && <Download className="size-3.5" aria-hidden="true" />}
                {doc.isPending ? 'Building' : '.docx'}
              </Button>
            }
          />

          {doc.isError && (
            <p role="alert" className="text-critical mb-3 text-xs break-words">
              {apiErrorMessage(doc.error, 'Could not build the document')}
            </p>
          )}

          {/* Markdown only; raw HTML stays disabled so model output can't
              inject markup into the page. */}
          <div className="prose-plan">
            <Markdown remarkPlugins={[remarkGfm]}>{plan.data}</Markdown>
          </div>
        </Card>
      )}

      {!plan.data && !plan.isPending && !plan.isError && (
        <EmptyState
          title="No plan yet"
          message="Press Guide me and the coach will build a nutrition and training plan from your baseline."
          action={
            <Button onClick={runGuide}>
              <Sparkles className="size-4" aria-hidden="true" />
              Guide me
            </Button>
          }
        />
      )}
    </div>
  )
}

/**
 * TEMPORARY stand-in for `useCoachPlan()`. Mirrors the slice of the mutation
 * surface this page reads, but resolves to canned markdown after a short delay
 * so the skeleton → plan transition still gets exercised. No network call.
 */
function useMockCoachPlan() {
  const [state, setState] = useState<{ pending: boolean; data?: string }>({ pending: false })
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const mutate = () => {
    window.clearTimeout(timer.current)
    setState({ pending: true })
    timer.current = window.setTimeout(() => setState({ pending: false, data: DUMMY_PLAN }), 900)
  }

  return { mutate, isPending: state.pending, isError: false, error: null, data: state.data }
}

const DUMMY_PLAN = `Congratulations on having a healthy BMI! To improve your physique, I'll provide you with a structured nutrition and workout plan. Please note that this is a general plan and may need to be adjusted based on your individual progress and preferences.

**Goal:** Improve overall physique, increase muscle mass, and enhance overall fitness.

## Nutrition Plan

To support muscle growth and overall health, you'll need to ensure you're consuming a balanced diet with adequate protein, carbohydrates, and healthy fats. Here's a daily nutrition plan for you:

1. **Caloric Intake:** To build muscle and support weight loss, you'll need to be in a caloric surplus. Aim for a daily caloric intake of 2500-2800 calories, which is approximately 100-200 calories above your BMR.
2. **Macronutrient Breakdown:**
   - Protein: 1.6-2.2 grams per kilogram of body weight (112-134 grams for you)
   - Carbohydrates: 2-3 grams per kilogram of body weight (138-207 grams for you)
   - Fat: 0.5-1 gram per kilogram of body weight (35-69 grams for you)
3. **Meal Frequency:** Aim for 5-6 meals per day, including 3 main meals, 2-3 snacks, and 1 post-workout shake.
4. **Meal Timing:**
   - Breakfast: within an hour of waking up
   - Snack: mid-morning and mid-afternoon
   - Lunch: 2-3 hours after breakfast
   - Pre-workout snack: 30-60 minutes before workout
   - Post-workout shake: within 30-60 minutes after workout
   - Dinner: 2-3 hours after workout
5. **Food Choices:**
   - Focus on whole, unprocessed foods: lean meats, fish, eggs, dairy, fruits, vegetables, whole grains, and healthy fats.
   - Include a source of protein with every meal.
   - Choose complex carbohydrates such as brown rice, quinoa, and whole grain bread.

### Sample Meal Plan

| Meal | Food | Calories | Protein |
| --- | --- | --- | --- |
| Breakfast | 3 whole eggs, 2 egg whites, 2 slices of whole grain toast, glass of orange juice | 400 | 30 g |
| Snack | 1 cup Greek yogurt, 1 scoop whey protein, 1 cup mixed berries | 200 | 20 g |
| Lunch | Grilled chicken breast, 1 cup brown rice, 1 cup steamed vegetables | 500 | 40 g |
| Snack | 1 medium apple, 1 tablespoon almond butter | 150 | 4 g |
| Pre-workout | 1 scoop whey protein, 1 cup watermelon | 100 | 15 g |
| Post-workout | 1 scoop whey protein, 1 cup milk, 1 cup frozen berries | 250 | 25 g |
| Dinner | Grilled salmon, 1 cup quinoa, 1 cup sautéed spinach | 500 | 40 g |

## Workout Plan

To improve your physique, you'll need to focus on a combination of resistance training and cardio exercises. Here's a sample workout plan:

**Day 1 — Chest and Triceps**

1. Barbell bench press (3 sets of 8-12 reps)
2. Incline dumbbell press (3 sets of 10-15 reps)
3. Cable fly (3 sets of 12-15 reps)
4. Tricep pushdown (3 sets of 10-12 reps)
5. Overhead dumbbell extension (3 sets of 12-15 reps)

**Day 2 — Back and Biceps**

1. Pull-up (3 sets of 8-12 reps)
2. Barbell row (3 sets of 8-12 reps)
3. Lat pulldown (3 sets of 10-12 reps)
4. Dumbbell bicep curl (3 sets of 10-12 reps)
5. Hammer curl (3 sets of 10-12 reps)

**Day 3 — Rest day**

**Day 4 — Legs**

1. Squat (3 sets of 8-12 reps)
2. Leg press (3 sets of 10-12 reps)
3. Lunges (3 sets of 10-12 reps per leg)
4. Leg extensions (3 sets of 12-15 reps)
5. Leg curls (3 sets of 10-12 reps)

**Day 5 — Shoulders and Abs**

1. Shoulder press (3 sets of 8-12 reps)
2. Lateral raises (3 sets of 10-12 reps)
3. Rear delt fly (3 sets of 12-15 reps)
4. Plank (3 sets of 30-60 seconds)
5. Russian twists (3 sets of 10-12 reps)

**Days 6 and 7 — Rest days**

## Additional Tips

1. **Warm up:** always warm up with 5-10 minutes of cardio and stretching before each workout.
2. **Cool down:** cool down with 5-10 minutes of stretching after each workout.
3. **Hydrate:** drink at least 8-10 glasses of water per day.
4. **Sleep:** aim for 7-8 hours of sleep per night.
5. **Progressive overload:** gradually increase the weight or resistance you're lifting over time to continue making progress.

Remember, consistency and patience are key. Stick to the plan, and you'll see improvements in your physique over time.`

function PlanSkeleton() {
  return (
    <Card>
      <div role="status" aria-live="polite" className="space-y-3">
        <span className="sr-only">Generating your plan</span>
        {['70%', '100%', '92%', '48%', '100%', '84%', '64%'].map((width, index) => (
          <div
            key={index}
            className="bg-raised h-3.5 animate-pulse rounded-full"
            style={{ width }}
          />
        ))}
      </div>
    </Card>
  )
}
