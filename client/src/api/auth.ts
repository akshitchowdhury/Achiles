import { api } from './client'
import type { AuthSession } from '../types'

/**
 * Google sign-in is a full-page redirect, not an XHR: the browser has to
 * visit Google and come back. `returnTo` is where the callback drops us
 * afterwards — it must be a path on this origin.
 */
export function googleLoginUrl(returnTo = '/auth/callback'): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api'
  return `${base}/login?return=${encodeURIComponent(returnTo)}`
}

/** Sends the browser to Google's consent screen. */
export function startGoogleLogin(returnTo?: string): void {
  window.location.assign(googleLoginUrl(returnTo))
}

/** GET /auth/me — resolves to `{ authenticated: false }` when signed out. */
export async function getAuthSession(): Promise<AuthSession> {
  const { data } = await api.get<AuthSession>('/auth/me')
  return data
}

/** POST /auth/link — attaches a new athlete row to the signed-in Google account. */
export async function linkAthlete(userId: number): Promise<void> {
  await api.post('/auth/link', { user_id: userId })
}

/** POST /auth/logout — drops the session cookie server-side. */
export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}
