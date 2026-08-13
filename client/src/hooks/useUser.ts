import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addUser, computeSpecs, getUserById } from '../api/users'
import { linkAthlete } from '../api/auth'
import { askGroq, rateTest } from '../api/ai'
import { generatePlanDoc } from '../api/docs'
import { authKeys, googleIdentity, useAuthSession } from './useAuth'
import { saveBlob } from '../lib/download'
import { useSession } from '../store/session'
import { isPlanSlug, type NewUser } from '../types'

export const userKeys = {
  detail: (id: number) => ['user', id] as const,
}

/** Loads the signed-in user's profile + specs. Idle until a session exists. */
export function useCurrentUser() {
  const userId = useSession((s) => s.userId)

  return useQuery({
    queryKey: userKeys.detail(userId ?? -1),
    queryFn: () => getUserById(userId as number),
    enabled: userId != null,
    retry: false,
    staleTime: 60_000,
  })
}

/**
 * Onboarding: create the row, then compute its specs so the dashboard has
 * something to read. getUserById 404s until the specs row exists, so the
 * second call isn't optional.
 *
 * When the person got here through Google, the new athlete id is also linked
 * to their Google account so the next sign-in resumes straight to the
 * dashboard instead of asking for these numbers again.
 */
export function useGuestSignUp() {
  const signIn = useSession((s) => s.signIn)
  const queryClient = useQueryClient()
  const { data: auth } = useAuthSession()
  const google = googleIdentity(auth)

  return useMutation({
    mutationFn: async (payload: NewUser) => {
      const created = await addUser(payload)
      await computeSpecs(created.id)

      if (google && google.user_id == null) {
        // Non-fatal: the profile exists either way, and a failed link only
        // costs a re-onboard on the next Google sign-in.
        try {
          await linkAthlete(created.id)
        } catch (err) {
          console.warn('Could not link this profile to your Google account', err)
        }
      }
      return created
    },
    onSuccess: (created) => {
      signIn({
        userId: created.id,
        name: created.name,
        weight: created.weight,
        gender: created.gender,
        email: google?.email,
        picture: google?.picture,
      })
      queryClient.invalidateQueries({ queryKey: userKeys.detail(created.id) })
      queryClient.invalidateQueries({ queryKey: authKeys.session })
    },
  })
}

/**
 * Resume an existing profile by id. Verifies it exists before storing it.
 *
 * Doubles as the way an athlete who already has a number claims it with
 * Google: sign in first, resume here, and the two get linked.
 */
export function useResumeSession() {
  const signIn = useSession((s) => s.signIn)
  const choosePlan = useSession((s) => s.choosePlan)
  const queryClient = useQueryClient()
  const { data: auth } = useAuthSession()
  const google = googleIdentity(auth)

  return useMutation({
    mutationFn: async (id: number) => {
      const details = await getUserById(id)
      if (google && google.user_id == null) {
        try {
          await linkAthlete(details.id)
        } catch (err) {
          console.warn('Could not link this profile to your Google account', err)
        }
      }
      return details
    },
    onSuccess: (details) => {
      signIn({
        userId: details.id,
        name: details.name,
        weight: details.weight,
        gender: details.gender,
        email: google?.email,
        picture: google?.picture,
      })
      // Resuming always starts from a null planSlug (a fresh device, or
      // signOut having just cleared it), so an athlete who already picked a
      // plan on the server needs it restored here — otherwise AppShell reads
      // the still-null local value and bounces them back to /select-plan
      // every time they log back in.
      if (details.training_plan && isPlanSlug(details.training_plan.slug)) {
        choosePlan(details.training_plan.slug)
      }
      queryClient.setQueryData(userKeys.detail(details.id), details)
      queryClient.invalidateQueries({ queryKey: authKeys.session })
    },
  })
}

/** Calls the coach. The server builds the prompt from stored metrics. */
export function useCoachPlan() {
  return useMutation({
    mutationFn: (id: number) => askGroq(id),
  })
}

/**
 * Spends one token against /rateTest. Retries stay off deliberately: a 429 is
 * the answer this button exists to show, and retrying would both hide it and
 * burn the tokens that make the next press meaningful.
 */
export function useRateTest() {
  return useMutation({
    mutationFn: () => rateTest(),
    retry: false,
  })
}

/**
 * Sends a finished plan to /docgeneration and saves the .docx it returns.
 * Nothing is cached — the document is a one-shot side effect, not state.
 */
export function usePlanDoc() {
  return useMutation({
    mutationFn: (content: string) => generatePlanDoc(content),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
  })
}
