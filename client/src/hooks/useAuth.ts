import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAuthSession, linkAthlete, logout } from '../api/auth'
import { useSession } from '../store/session'
import type { AuthSession, GoogleIdentity } from '../types'

export const authKeys = {
  session: ['auth', 'session'] as const,
}

/**
 * Narrows a possibly-absent session down to a signed-in one. Written as a
 * function because `session?.authenticated ? session : null` inline does not
 * narrow the union for TypeScript.
 */
export function googleIdentity(session: AuthSession | undefined): GoogleIdentity | null {
  return session !== undefined && session.authenticated ? session : null
}

/**
 * Reads the Google session cookie via GET /auth/me.
 *
 * Signed out is a normal answer here, not an error — the endpoint returns
 * 200 with `authenticated: false` — so a failure means the server is
 * unreachable and is worth surfacing.
 */
export function useAuthSession() {
  return useQuery({
    queryKey: authKeys.session,
    queryFn: getAuthSession,
    retry: false,
    staleTime: 60_000,
  })
}

/** Attaches a newly created athlete row to the signed-in Google account. */
export function useLinkAthlete() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: linkAthlete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.session }),
  })
}

/**
 * Clears both halves of the session: the local athlete id and, if there is
 * one, the server cookie. The cookie call is best-effort — a network failure
 * shouldn't strand someone on a screen they're trying to leave.
 */
export function useSignOut() {
  const clearLocal = useSession((s) => s.signOut)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        await logout()
      } catch {
        // Ignored on purpose — see above.
      }
    },
    onSettled: () => {
      clearLocal()
      queryClient.clear()
    },
  })
}
