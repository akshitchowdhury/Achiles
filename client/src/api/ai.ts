import axios from 'axios'
import { api, apiErrorMessage } from './client'

interface AskAchilesEnvelope {
  message: string
  /** The answer the RAG service generated — already plain text. */
  Achiles_Response: string
}

/**
 * Retrieval plus generation on the Python side runs well past the client's
 * 30s default, and the Go handler gives the gRPC call 120s. Aborting sooner
 * than the server does would report a failure for a request still being
 * answered, so this waits out the server's own budget.
 */
const ACHILES_TIMEOUT_MS = 125_000

/**
 * POST /askAchiles?id=N — the server builds the prompt from the user's stored
 * metrics and selected plan, so there's no body to send.
 *
 * Unlike the /askGroq endpoint this replaced, nothing here is a provider
 * passthrough: the Go handler talks to the RAG service and hands back the
 * generated text directly, so there is no completion envelope to unwrap.
 *
 * The text still arrives carrying Markdown markers, because that is how the
 * prompt asks for structure. Stripping them is the renderer's job — see
 * `lib/planText`.
 */
export async function askAchiles(id: number): Promise<string> {
  const { data } = await api.post<AskAchilesEnvelope>('/askAchiles', null, {
    params: { id },
    timeout: ACHILES_TIMEOUT_MS,
  })

  const answer = data.Achiles_Response?.trim()
  if (!answer) throw new Error('The coach returned an empty plan. Try again.')

  return answer
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
