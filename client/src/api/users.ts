import { api } from './client'
import type { BmiResponse, NewUser, User, UserDetails } from '../types'

/** POST /addUser — inserts the row and echoes it back with the generated id. */
export async function addUser(payload: NewUser): Promise<User> {
  const { data } = await api.post<User>('/addUser', payload)
  return data
}

/**
 * GET /getBMI?id=N — computes BMI/BMR and writes the user_specs row.
 *
 * Two server quirks to respect:
 *  1. The handler decodes a JSON body even though this is a GET, so it 400s on
 *     an empty one. A browser cannot send a body on GET at all, so the Vite dev
 *     proxy attaches `{}` on the way through — see the shim in vite.config.ts.
 *  2. It INSERTs rather than upserts, so a second call for the same user hits a
 *     constraint and 500s. Call this once right after signup, never on load.
 */
export async function computeSpecs(id: number): Promise<BmiResponse> {
  const { data } = await api.get<BmiResponse>('/getBMI', { params: { id } })
  return data
}

/**
 * GET /getUserById?id=N — returns the profile with its specs nested.
 * 404s with "specs not found" until computeSpecs has run for that user.
 */
export async function getUserById(id: number): Promise<UserDetails> {
  const { data } = await api.get<{ userDetails: UserDetails }>('/getUserById', {
    params: { id },
  })
  return data.userDetails
}
