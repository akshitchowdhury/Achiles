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
