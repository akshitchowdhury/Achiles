import { api } from './client'
import type { TrainingPlan } from '../types'

/**
 * GET /getPlans — the training-plan catalogue, ordered by id server-side.
 *
 * Returns [] on an empty table rather than null, so callers can map straight
 * over the result.
 */
export async function getPlans(): Promise<TrainingPlan[]> {
  const { data } = await api.get<TrainingPlan[] | null>('/getPlans')
  return data ?? []
}
