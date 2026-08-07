import axios from 'axios'
import { api } from './client'
import type { NutritionTemplate, PlanDashboard, WorkoutExercise, WorkoutTemplate } from '../types'

/**
 * POST /selectPlan — links a user to a catalog plan by id. This is the
 * persisted half of plan selection; store/session's `choosePlan` is the
 * on-device half that drives theming.
 */
export async function selectPlan(userId: number, trainingPlanId: number): Promise<void> {
  await api.post('/selectPlan', { user_id: userId, training_plan_id: trainingPlanId })
}

/**
 * GET /getDashboard?id=N — the plan a user selected, plus its nutrition
 * template and workout templates/exercises, once authored.
 *
 * Resolves to null rather than throwing when the user hasn't selected a
 * plan yet (server 404s), so callers can treat "no plan" as data, not an error.
 */
export async function getDashboard(userId: number): Promise<PlanDashboard | null> {
  try {
    const { data } = await api.get<{ dashboard: PlanDashboard }>('/getDashboard', {
      params: { id: userId },
    })
    return data.dashboard
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null
    throw err
  }
}

export type NewNutritionTemplate = Omit<NutritionTemplate, 'id'>

/** POST /addNutritionTemplate — authors the (single) nutrition template for a plan. */
export async function addNutritionTemplate(
  payload: NewNutritionTemplate,
): Promise<NutritionTemplate> {
  const { data } = await api.post<NutritionTemplate>('/addNutritionTemplate', payload)
  return data
}

export type NewWorkoutTemplate = Omit<WorkoutTemplate, 'id' | 'exercises'>

/** POST /addWorkoutTemplate — authors one training day for a plan. */
export async function addWorkoutTemplate(payload: NewWorkoutTemplate): Promise<WorkoutTemplate> {
  const { data } = await api.post<WorkoutTemplate>('/addWorkoutTemplate', payload)
  return data
}

export type NewWorkoutExercise = Omit<WorkoutExercise, 'id'>

/** POST /addWorkoutExercise — appends one movement to a workout template. */
export async function addWorkoutExercise(payload: NewWorkoutExercise): Promise<WorkoutExercise> {
  const { data } = await api.post<WorkoutExercise>('/addWorkoutExercise', payload)
  return data
}
