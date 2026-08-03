import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAuthSession } from '../api/auth'
import { getUserById } from '../api/users'
import { apiErrorMessage } from '../api/client'
import { useSession } from '../store/session'
import { Wordmark } from '../components/layout/Logo'

/**
 * Where the Go callback drops the browser after Google. By this point the
 * session cookie is already set, so all this screen does is read it back and
 * decide which way to send you:
 *
 *   linked athlete  -> load the profile, restore the session, go to /
 *   first sign-in   -> /welcome to fill in the numbers we can't get from Google
 *   error           -> /welcome with the reason
 *
 * The two /welcome hops carry the Google profile in router state so the form
 * can greet you by name.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const signIn = useSession((s) => s.signIn)
  const [error, setError] = useState<string | null>(null)

  // StrictMode double-invokes effects in dev; the redirect must run once.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const failure = params.get('error')
    if (failure) {
      navigate('/welcome', { replace: true, state: { authError: failure } })
      return
    }

    void (async () => {
      try {
        const session = await getAuthSession()

        if (!session.authenticated) {
          navigate('/welcome', {
            replace: true,
            state: { authError: 'Google sign-in did not complete. Please try again.' },
          })
          return
        }

        const google = {
          email: session.email,
          name: session.name,
          picture: session.picture,
        }

        // No athlete row yet — first time through, so finish onboarding.
        if (session.user_id == null) {
          navigate('/welcome', { replace: true, state: { google } })
          return
        }

        // Returning user. getUserById 404s when the specs row is missing,
        // which means the profile was never completed — treat it as a first
        // sign-in rather than a dead end.
        try {
          const details = await getUserById(session.user_id)
          signIn({
            userId: details.id,
            name: details.name,
            weight: details.weight,
            gender: details.gender,
            email: google.email,
            picture: google.picture,
          })
          navigate('/', { replace: true })
        } catch {
          navigate('/welcome', { replace: true, state: { google } })
        }
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not finish signing you in'))
      }
    })()
  }, [navigate, params, signIn])

  return (
    <div className="bg-plane flex min-h-svh flex-col items-center justify-center gap-6 px-5">
      <Wordmark />
      {error ? (
        <div className="text-center">
          <p className="text-ink text-sm font-semibold">Could not finish signing you in</p>
          <p className="text-ink-dim mt-1 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/welcome', { replace: true })}
            className="text-volt mt-4 text-sm underline underline-offset-4"
          >
            Back to sign-in
          </button>
        </div>
      ) : (
        <p role="status" className="text-ink-dim flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Finishing sign-in
        </p>
      )}
    </div>
  )
}
