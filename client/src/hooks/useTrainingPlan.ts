import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addNutritionTemplate,
  addWorkoutExercise,
  addWorkoutTemplate,
  getDashboard,
  selectPlan,
} from '../api/trainingPlan'
import { userKeys } from './useUser'

export const dashboardKeys = {
  detail: (userId: number) => ['dashboard', userId] as const,
}

/**
 * The selected plan's dashboard: plan art + nutrition + workouts. `data` is
 * `null` (not an error) when the user hasn't picked a plan yet.
 */
export function useDashboard(userId: number | null) {
  return useQuery({
    queryKey: dashboardKeys.detail(userId ?? -1),
    queryFn: () => getDashboard(userId as number),
    enabled: userId != null,
    staleTime: 60_000,
  })
}

/**
 * Persists plan selection to userinfo.training_plan_id. Callers still need
 * store/session's `choosePlan` alongside this — that half drives the local
 * theme and isn't something the server tracks.
 */
export function useSelectPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, trainingPlanId }: { userId: number; trainingPlanId: number }) =>
      selectPlan(userId, trainingPlanId),
    onSuccess: (_data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.detail(userId) })
    },
  })
}

/** Authors the nutrition template for a plan. Content-authoring, not an athlete action. */
export function useAddNutritionTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addNutritionTemplate,
    // Dashboards are keyed by user id, not plan id, and any number of users
    // could be on this plan — invalidate every cached dashboard rather than
    // trying to know which ones.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/** Authors one training day for a plan. Content-authoring, not an athlete action. */
export function useAddWorkoutTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addWorkoutTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })
}

/** Appends one movement to a workout template. Content-authoring, not an athlete action. */
export function useAddWorkoutExercise() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addWorkoutExercise,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  })
}
