import { api } from './client'
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
