import axios from 'axios'
import { api, apiErrorMessage } from './client'
import type { GroqCompletion } from '../types'

interface AskGroqEnvelope {
  message: string
  /** The upstream Groq response, forwarded as an unparsed JSON string. */
  Ai_Response: string
}

/**
 * POST /askGroq?id=N — the server builds the prompt from the user's stored
 * metrics, so there's no body to send.
 *
 * It forwards Groq's raw response body as a *string* inside `Ai_Response`,
 * so we parse it here and dig out the assistant message.
 */
export async function askGroq(id: number): Promise<string> {
  const { data } = await api.post<AskGroqEnvelope>('/askGroq', null, { params: { id } })

  let parsed: GroqCompletion
  try {
    parsed = JSON.parse(data.Ai_Response) as GroqCompletion
  } catch {
    // Not JSON — surface whatever the server passed through rather than crashing.
    throw new Error(data.Ai_Response?.slice(0, 300) || 'Unreadable response from the coach')
  }

  if (parsed.error?.message) throw new Error(parsed.error.message)

  const content = parsed.choices?.[0]?.message?.content
  if (!content) throw new Error('The coach returned an empty plan. Try again.')

  return content
}

/**
 * What /rateTest answers with on a 200. `Response code` is the server's name
 * for the tokens left in the bucket — it is not an HTTP status.
 */
interface RateTestEnvelope {
  message: string
  remaining: number
  Response: string
}

export interface RateTestResult {
  message: string
  /** Tokens left in this caller's bucket after the request was counted. */
  remaining: number
}

/**
 * Thrown when the server answers 429. The limiter refusing a request is the
 * endpoint working, not failing, so it gets its own type and carries the wait
 * rather than collapsing into a generic error string.
 */
export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number

  constructor(message: string, retryAfterSeconds: number) {
    super(message)
    this.name = 'RateLimitedError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * POST /rateTest — spends one token from the caller's bucket. There is nothing
 * to send; making the call *is* the request.
 */
export async function rateTest(): Promise<RateTestResult> {
  try {
    const { data } = await api.post<RateTestEnvelope>('/rateTest')
    return { message: data.message, remaining: data.remaining ?? 0 }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 429) {
      // The server does not set Retry-After yet, so fall back to the bucket's
      // configured refill interval of one second. Once the header lands this
      // starts honouring it with no change here.
      const header = Number(err.response.headers['retry-after'])
      throw new RateLimitedError(
        apiErrorMessage(err, 'Rate limit reached'),
        Number.isFinite(header) && header > 0 ? header : 1,
      )
    }
    throw err
  }
}
