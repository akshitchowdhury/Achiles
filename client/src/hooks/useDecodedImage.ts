import { useEffect, useState } from 'react'

export interface DecodedImage {
  /** Only non-null once the bitmap is decoded and safe to paint. */
  src: string | null
  width: number
  height: number
  failed: boolean
}

const IDLE: DecodedImage = { src: null, width: 0, height: 0, failed: false }

/**
 * Preloads and decodes an image before anything paints it.
 *
 * This is load-bearing rather than an optimisation, for two reasons:
 *
 *  1. `background-image` fires no load or error event. A 403 on a private
 *     bucket, a missing key, or an expired presigned URL is otherwise
 *     completely invisible — the card would just render an empty box with no
 *     way to know it should show its fallback art instead.
 *  2. The cylinder paints the same URL across 14 facets. Without a decoded
 *     bitmap in the cache first, the facets resolve on different frames and
 *     the image visibly tears as it assembles.
 *
 * naturalWidth/Height come back with it because `cover` has to be computed in
 * JS against the barrel box — see the maths in PlanCylinderCard.
 */
export function useDecodedImage(url: string | undefined): DecodedImage {
  const [state, setState] = useState<DecodedImage>(IDLE)

  useEffect(() => {
    if (!url) {
      setState({ ...IDLE, failed: true })
      return
    }

    setState(IDLE)
    let live = true
    const img = new Image()

    img.onload = () => {
      // decode() can reject on detached images in Safari; the bitmap is
      // already usable by then, so a rejection is not a failure.
      const done = () => {
        if (live) {
          setState({ src: url, width: img.naturalWidth, height: img.naturalHeight, failed: false })
        }
      }
      if (typeof img.decode === 'function') {
        img.decode().then(done, done)
      } else {
        done()
      }
    }

    // Logged once, never retried: a 404 on a private bucket will not fix
    // itself, and re-requesting five URLs per mount is pure waste.
    img.onerror = () => {
      if (!live) return
      console.warn(`Plan image unavailable, using fallback art: ${url}`)
      setState({ ...IDLE, failed: true })
    }

    img.src = url
    return () => {
      live = false
      img.onload = null
      img.onerror = null
    }
  }, [url])

  return state
}
