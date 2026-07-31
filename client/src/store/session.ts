import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Gender } from '../types'

/**
 * There's no real auth on the server — a "session" is just the user id we're
 * currently looking at, kept in localStorage so a refresh doesn't log you out.
 *
 * `weight` is cached here on purpose: GET /getUserById omits it from the JSON
 * it builds, so this is the only place the client can read it back.
 */
interface SessionState {
  userId: number | null
  name: string | null
  weight: number | null
  gender: Gender | null
  signIn: (payload: { userId: number; name?: string; weight?: number; gender?: Gender }) => void
  signOut: () => void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      userId: null,
      name: null,
      weight: null,
      gender: null,
      signIn: ({ userId, name, weight, gender }) =>
        set({
          userId,
          name: name ?? null,
          weight: weight ?? null,
          gender: gender ?? null,
        }),
      signOut: () => set({ userId: null, name: null, weight: null, gender: null }),
    }),
    { name: 'achiles.session' },
  ),
)
