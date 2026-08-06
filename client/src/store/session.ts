import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isPlanSlug, type Gender, type PlanSlug } from '../types'

/**
 * A "session" is the athlete id we're currently looking at, kept in
 * localStorage so a refresh doesn't log you out.
 *
 * Signing in with Google adds a second, authoritative layer: an HttpOnly
 * cookie on the Go server. What's cached here is only the display half of
 * that (`email`, `picture`) — the cookie is what the server trusts, and
 * GET /auth/me is what reconciles the two on load.
 *
 * `weight` is cached here on purpose: GET /getUserById omits it from the JSON
 * it builds, so this is the only place the client can read it back.
 */
interface SessionState {
  userId: number | null
  name: string | null
  weight: number | null
  gender: Gender | null
  /** Set when the athlete arrived via Google rather than the guest form. */
  email: string | null
  picture: string | null
  /**
   * The training plan chosen after signup, which decides the theme and layout
   * for the whole app. Null means the athlete has not picked yet, and the
   * router sends them to /select-plan.
   *
   * This lives only on the device: the Go users table has no plan column, so
   * there is nowhere on the server to put it yet. Clearing site data resets an
   * athlete to the picker.
   */
  planSlug: PlanSlug | null
  signIn: (payload: {
    userId: number
    name?: string
    weight?: number
    gender?: Gender
    email?: string | null
    picture?: string | null
  }) => void
  choosePlan: (slug: PlanSlug) => void
  signOut: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      name: null,
      weight: null,
      gender: null,
      email: null,
      picture: null,
      planSlug: null,
      // Deliberately leaves planSlug alone: signIn also runs when an existing
      // athlete resumes, and their theme should survive that.
      signIn: ({ userId, name, weight, gender, email, picture }) =>
        set({
          userId,
          name: name ?? null,
          weight: weight ?? null,
          gender: gender ?? null,
          email: email ?? null,
          picture: picture ?? null,
        }),
      choosePlan: (planSlug) => set({ planSlug }),
      signOut: () =>
        set({
          userId: null,
          name: null,
          weight: null,
          gender: null,
          email: null,
          picture: null,
          planSlug: null,
        }),
    }),
    {
      name: 'achiles.session',
      /**
       * Drop a planSlug this build no longer recognises.
       *
       * Storage outlives the code: a plan removed from PLAN_SLUGS would
       * otherwise be read back as a live theme, and the athlete would land on a
       * layout lookup with nothing behind it. Nulling it sends them to the
       * picker, which is the honest outcome. registry.layoutFor guards the same
       * case defensively; this is the one that keeps state and document in
       * agreement.
       */
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<SessionState>
        return {
          ...current,
          ...saved,
          planSlug: isPlanSlug(saved.planSlug) ? saved.planSlug : null,
        }
      },
    },
  ),
)
