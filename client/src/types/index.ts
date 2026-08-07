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
 * Two pieces of art, and they are not interchangeable. `image_*` is the COVER
 * — a portrait crop drawn on the picker's cylinder cards at 248px wide.
 * `watermark_*` is the BACKDROP the app fades in full-bleed behind every
 * screen, sourced separately because a card-sized cover blown up to viewport
 * width is a smear.
 *
 * The `_key` fields are bare S3 object keys; the `_url` fields are derived
 * server-side from the bucket and are absent when their key is empty, hence
 * optional. `watermark_key` is empty on rows written before the column
 * existed, so treat a missing watermark as normal and fall back to the cover.
 */
export interface TrainingPlan {
  id: number
  name: string
  slug: string
  description: string
  image_key: string
  image_url?: string
  watermark_key?: string
  watermark_url?: string
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
