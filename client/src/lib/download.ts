/**
 * Saves a blob to the user's downloads via a throwaway anchor. The object URL
 * is revoked on the next tick — revoking it synchronously can race the click in
 * some browsers.
 */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}