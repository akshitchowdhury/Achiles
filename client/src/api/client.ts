import axios from 'axios'

/** Vite dev-server proxies /api → the Go server (see vite.config.ts). */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

/**
 * The Go handlers write plain-text bodies via http.Error, so an axios error
 * carries the reason as a bare string rather than a JSON envelope.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (typeof data === 'string' && data.trim()) return data.trim()
    if (data && typeof data === 'object' && 'message' in data) {
      return String((data as { message: unknown }).message)
    }
    if (err.code === 'ERR_NETWORK') {
      return 'Cannot reach the Achiles server. Is it running on port 8080?'
    }
    return err.message || fallback
  }
  return err instanceof Error ? err.message : fallback
}
