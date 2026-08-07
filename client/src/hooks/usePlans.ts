import { useQuery } from '@tanstack/react-query'
import { getPlans } from '../api/plans'

export const planKeys = {
  all: ['plans'] as const,
}

/**
 * The plan catalogue. Reference data that only changes when someone re-seeds it
 * through /addPlans, so it is cached hard — refetching it on every mount would
 * make the picker flicker for no benefit.
 */
export function usePlans() {
  return useQuery({
    queryKey: planKeys.all,
    queryFn: getPlans,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
