import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Gender } from '../types'

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
  signIn: (payload: {
    userId: number
    name?: string
    weight?: number
    gender?: Gender
    email?: string | null
    picture?: string | null
  }) => void
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
      signIn: ({ userId, name, weight, gender, email, picture }) =>
        set({
          userId,
          name: name ?? null,
          weight: weight ?? null,
          gender: gender ?? null,
          email: email ?? null,
          picture: picture ?? null,
        }),
      signOut: () =>
        set({ userId: null, name: null, weight: null, gender: null, email: null, picture: null }),
    }),
    { name: 'achiles.session' },
  ),
)
