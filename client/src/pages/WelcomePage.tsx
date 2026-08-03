import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowRight, Flame, HeartPulse, Timer } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { SelectField, TextField } from '../components/ui/Field'
import { ErrorPanel } from '../components/ui/Feedback'
import { GoogleButton } from '../components/ui/GoogleButton'
import { Wordmark } from '../components/layout/Logo'
import { apiErrorMessage } from '../api/client'
import { startGoogleLogin } from '../api/auth'
import { googleIdentity, useAuthSession } from '../hooks/useAuth'
import { useGuestSignUp, useResumeSession } from '../hooks/useUser'
import { useSession } from '../store/session'

/** Bounds keep the BMI/BMR maths meaningful rather than merely non-empty. */
const guestSchema = z.object({
  name: z.string().trim().min(2, 'Tell us what to call you').max(60, 'That name is too long'),
  age: z.coerce.number().int('Whole years only').min(13, 'Must be 13 or older').max(100, 'Enter a real age'),
  weight: z.coerce.number().min(30, 'At least 30 kg').max(300, 'At most 300 kg'),
  height_cm: z.coerce.number().min(100, 'At least 100 cm').max(250, 'At most 250 cm'),
  gender: z.enum(['Male', 'Female']),
})

type GuestForm = z.input<typeof guestSchema>

const HIGHLIGHTS = [
  { icon: HeartPulse, title: 'Know your baseline', body: 'BMI, BMR and a body-composition verdict from day one.' },
  { icon: Flame, title: 'Calories that fit you', body: 'Maintenance and target intake scaled to how you actually train.' },
  { icon: Timer, title: 'A plan, not a guess', body: 'Structured nutrition and training built around your numbers.' },
]

/** Router state set by AuthCallbackPage when it bounces someone back here. */
interface WelcomeState {
  google?: { email: string; name: string; picture: string }
  authError?: string
}

export function WelcomePage() {
  const userId = useSession((s) => s.userId)
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'guest' | 'resume'>('guest')

  const { google, authError } = (location.state ?? {}) as WelcomeState
  // Falls back to the cookie so a refresh on this page keeps the Google
  // context that router state alone would lose.
  const { data: auth } = useAuthSession()
  const identity = google ?? googleIdentity(auth)

  const signUp = useGuestSignUp()
  const resume = useResumeSession()
  const [resumeId, setResumeId] = useState('')

  const form = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: { name: '', age: '' as unknown as number, weight: '' as unknown as number, height_cm: '' as unknown as number, gender: 'Male' },
  })

  // Google gives us a name and nothing else the BMR maths needs, so prefill
  // that one field and leave the rest to be filled in.
  const { setValue, getValues } = form
  useEffect(() => {
    if (identity?.name && !getValues('name')) {
      setValue('name', identity.name, { shouldValidate: false })
    }
  }, [identity?.name, setValue, getValues])

  if (userId != null) return <Navigate to="/" replace />

  const onGuestSubmit = form.handleSubmit(async (values) => {
    const parsed = guestSchema.parse(values)
    await signUp.mutateAsync(parsed)
    navigate('/', { replace: true })
  })

  const onResumeSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const id = Number(resumeId)
    if (!Number.isInteger(id) || id <= 0) return
    await resume.mutateAsync(id)
    navigate('/', { replace: true })
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="border-hairline hatch relative hidden flex-col justify-between border-r p-10 lg:flex">
        <Wordmark />

        <div className="max-w-md">
          <h1 className="text-ink text-5xl leading-[1.05] font-semibold tracking-tight">
            Train with
            <br />
            <span className="text-volt">evidence</span>, not
            <br />
            guesswork.
          </h1>
          <p className="text-ink-dim mt-5 text-base">
            Achiles turns your measurements into a baseline you can act on — then
            builds the nutrition and training around it.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="border-hairline bg-surface flex size-9 shrink-0 items-center justify-center rounded-xl border">
                  <Icon className="text-volt size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-ink text-sm font-medium">{title}</p>
                  <p className="text-ink-muted mt-0.5 text-sm">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-ink-muted text-xs">
          No password, no email. Your profile lives on your own machine.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden">
            <Wordmark />
          </div>

          <h2 className="text-ink mt-8 text-2xl font-semibold tracking-tight lg:mt-0">
            {identity
              ? 'One more step'
              : mode === 'guest'
                ? 'Start as a guest'
                : 'Welcome back'}
          </h2>
          <p className="text-ink-dim mt-1.5 text-sm">
            {identity
              ? `Signed in as ${identity.email}. Google can't tell us your measurements, so we need those before we can build your baseline.`
              : mode === 'guest'
                ? 'Five numbers and you are in. We use them to compute your baseline.'
                : 'Enter the athlete number you were given when you signed up.'}
          </p>

          {authError && (
            <div className="mt-5">
              <ErrorPanel title="Google sign-in failed" message={authError} />
            </div>
          )}

          {/* Google sign-in — a full-page redirect to the Go /login route,
              so it deliberately sits outside the forms below. */}
          {!identity && (
            <>
              <div className="mt-6">
                <GoogleButton onClick={() => startGoogleLogin()} />
              </div>
              <div className="mt-6 flex items-center gap-3" aria-hidden="true">
                <span className="border-hairline flex-1 border-t" />
                <span className="text-ink-muted text-xs">or</span>
                <span className="border-hairline flex-1 border-t" />
              </div>
            </>
          )}

          {/* Mode switch */}
          <div
            role="tablist"
            aria-label="Sign-in method"
            className="border-hairline bg-surface mt-6 grid grid-cols-2 gap-1 rounded-xl border p-1"
          >
            {(['guest', 'resume'] as const).map((value) => (
              <button
                key={value}
                role="tab"
                type="button"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={
                  mode === value
                    ? 'bg-volt text-plane rounded-lg py-2 text-sm font-semibold'
                    : 'text-ink-dim hover:text-ink rounded-lg py-2 text-sm transition-colors'
                }
              >
                {value === 'guest' ? 'New here' : 'I have an ID'}
              </button>
            ))}
          </div>

          {mode === 'guest' ? (
            <form onSubmit={onGuestSubmit} noValidate className="mt-6 space-y-4">
              <TextField
                label="Name"
                autoComplete="name"
                placeholder="Alex Mercer"
                error={form.formState.errors.name?.message}
                {...form.register('name')}
              />

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Age"
                  suffix="years"
                  type="number"
                  inputMode="numeric"
                  placeholder="27"
                  error={form.formState.errors.age?.message}
                  {...form.register('age')}
                />
                <SelectField
                  label="Gender"
                  error={form.formState.errors.gender?.message}
                  options={[
                    { value: 'Male', label: 'Male' },
                    { value: 'Female', label: 'Female' },
                  ]}
                  {...form.register('gender')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  label="Weight"
                  suffix="kg"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="74.5"
                  error={form.formState.errors.weight?.message}
                  {...form.register('weight')}
                />
                <TextField
                  label="Height"
                  suffix="cm"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="178"
                  error={form.formState.errors.height_cm?.message}
                  {...form.register('height_cm')}
                />
              </div>

              {signUp.isError && (
                <ErrorPanel title="Could not create your profile" message={apiErrorMessage(signUp.error)} />
              )}

              <Button type="submit" size="lg" loading={signUp.isPending} className="w-full">
                {signUp.isPending ? 'Building your baseline' : 'Enter Achiles'}
                {!signUp.isPending && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>

              <p className="text-ink-muted text-center text-xs">
                Gender is used only to pick the right BMR formula.
              </p>
            </form>
          ) : (
            <form onSubmit={onResumeSubmit} noValidate className="mt-6 space-y-4">
              <TextField
                label="Athlete number"
                name="athleteId"
                type="number"
                inputMode="numeric"
                placeholder="1"
                value={resumeId}
                onChange={(event) => setResumeId(event.target.value)}
              />

              {resume.isError && (
                <ErrorPanel title="Could not find that athlete" message={apiErrorMessage(resume.error)} />
              )}

              <Button
                type="submit"
                size="lg"
                loading={resume.isPending}
                disabled={!resumeId}
                className="w-full"
              >
                Continue
                {!resume.isPending && <ArrowRight className="size-4" aria-hidden="true" />}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
