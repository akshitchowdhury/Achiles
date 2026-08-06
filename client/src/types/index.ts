/** Shapes mirroring the Go handlers in server/go_be_skeleton/internal. */

export type Gender = 'Male' | 'Female'

/** Request/response body of POST /addUser — matches user.User. */
export interface User {
  id: number
  name: string
  age: number
  weight: number
  gender: Gender
  height_cm: number
}

export type NewUser = Omit<User, 'id'>

/** The `specs` sub-object of GET /getUserById. Keys are capitalised server-side. */
export interface UserSpecs {
  BMI: number
  BMR: number
  Verdict: string
  WaterIntake: number
}

export interface UserDetails {
  id: number
  name: string
  age: number
  gender: Gender
  height_cm: number
  specs: UserSpecs
  weight: number
  
}

/**
 * One row of GET /getPlans — matches trainingplan.TrainingPlan.
 *
 * `image_key` is the bare S3 object key; `image_url` is derived server-side from
 * the bucket and is absent when the key is empty, hence optional.
 */
export interface TrainingPlan {
  id: number
  name: string
  slug: string
  description: string
  image_key: string
  image_url?: string
}

/**
 * The five plans the client knows how to theme. The server is free to return
 * others — `isPlanSlug` is what keeps an unknown slug from being treated as a
 * theme.
 */
export const PLAN_SLUGS = ['spartan', 'greek-god', 'superhero', 'athlete', 'manga'] as const

export type PlanSlug = (typeof PLAN_SLUGS)[number]

export function isPlanSlug(value: unknown): value is PlanSlug {
  return typeof value === 'string' && (PLAN_SLUGS as readonly string[]).includes(value)
}

/** GET /getBMI response. `Verict_user` is spelled that way server-side. */
export interface BmiResponse {
  'Calculated BMI': number
  'Calculated BMR': number
  Verict_user: string
}

/**
 * GET /auth/me — who the Google session cookie says you are.
 *
 * `user_id` is null until the Google account has been linked to an athlete
 * row, which happens the first time you finish the profile form.
 */
export interface GoogleIdentity {
  authenticated: true
  provider: string
  email: string
  name: string
  picture: string
  user_id: number | null
}

export type AuthSession = { authenticated: false } | GoogleIdentity

/** Shape of the Groq chat completion nested inside askGroq's `Ai_Response`. */
export interface GroqCompletion {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}
