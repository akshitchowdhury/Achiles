import axios from 'axios'
import { api } from './client'

const FALLBACK_FILENAME = 'achiles-plan.docx'

/**
 * POST /docgeneration — hands the plan text to the server and gets a .docx back,
 * so the document always matches the plan on screen.
 *
 * The body is a bare JSON string — `"…plan…"` — not a `{ content: … }`
 * envelope, because ServeDocxHandler decodes straight into a string.
 */
export async function generatePlanDoc(content: string): Promise<{
  blob: Blob
  filename: string
}> {
  try {
    const res = await api.post<Blob>('/docgeneration', JSON.stringify(content), {
      responseType: 'blob',
    })

    return { blob: res.data, filename: filenameFrom(res.headers['content-disposition']) }
  } catch (err) {
    // responseType 'blob' also wraps http.Error's plain-text body in a Blob,
    // which apiErrorMessage can't read — swap it back to text before rethrowing
    // so the UI shows the server's reason instead of a generic message.
    if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
      err.response.data = await err.response.data.text()
    }
    throw err
  }
}

/** Pulls `filename="…"` out of a Content-Disposition header. */
function filenameFrom(header: unknown): string {
  if (typeof header !== 'string') return FALLBACK_FILENAME
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header)
  return match?.[1]?.trim() || FALLBACK_FILENAME
}