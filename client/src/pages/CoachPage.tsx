import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Compass, RotateCcw, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState, ErrorPanel } from '../components/ui/Feedback'
import { StatusBadge } from '../components/ui/StatusBadge'
import { apiErrorMessage } from '../api/client'
import { useCoachPlan, useCurrentUser } from '../hooks/useUser'
import { useSession } from '../store/session'
import { verdictTone } from '../lib/fitness'
import { num, decimal } from '../lib/format'

export function CoachPage() {
  const userId = useSession((s) => s.userId)
  const { data: user } = useCurrentUser()
  const plan = useCoachPlan()

  const runGuide = () => {
    if (userId != null) plan.mutate(userId)
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
          />
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
