import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addUser, computeSpecs, getUserById } from '../api/users'
import { askGroq } from '../api/ai'
import { useSession } from '../store/session'
import type { NewUser } from '../types'

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
 * Guest onboarding: create the row, then compute its specs so the dashboard
 * has something to read. getUserById 404s until the specs row exists, so the
 * second call isn't optional.
 */
export function useGuestSignUp() {
  const signIn = useSession((s) => s.signIn)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: NewUser) => {
      const created = await addUser(payload)
      await computeSpecs(created.id)
      return created
    },
    onSuccess: (created) => {
      signIn({
        userId: created.id,
        name: created.name,
        weight: created.weight,
        gender: created.gender,
      })
      queryClient.invalidateQueries({ queryKey: userKeys.detail(created.id) })
    },
  })
}

/** Resume an existing profile by id. Verifies it exists before storing it. */
export function useResumeSession() {
  const signIn = useSession((s) => s.signIn)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => getUserById(id),
    onSuccess: (details) => {
      signIn({ userId: details.id, name: details.name, gender: details.gender })
      queryClient.setQueryData(userKeys.detail(details.id), details)
    },
  })
}

/** Calls the coach. The server builds the prompt from stored metrics. */
export function useCoachPlan() {
  return useMutation({
    mutationFn: (id: number) => askGroq(id),
  })
}
