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

/**
 * True once every URL in the batch has loaded — or failed — at least once.
 *
 * Built for gating a skeleton over a group of cards: without it, each card
 * resolves its own useDecodedImage on its own schedule, so the picker paints
 * photos in one at a time while the skeleton has already been swapped out
 * from under them. Settling on error as well as success matters for the same
 * reason useDecodedImage does — a 403 or an expired presigned URL should
 * reveal that card's fallback gradient, not hold every OTHER card's skeleton
 * up forever.
 *
 * Deliberately its own image loads rather than reusing useDecodedImage's
 * state: by the time this resolves, the browser's HTTP cache already holds
 * the bytes, so the same URL requested again inside each card resolves
 * without a second round trip.
 */
export function useImagesSettled(urls: Array<string | undefined>): boolean {
  // Reduced to a string so the effect keys on CONTENT, not the array's
  // identity — callers pass a freshly-mapped array on every render.
  const key = urls.filter((url): url is string => Boolean(url)).join('\n')
  const [settled, setSettled] = useState(key.length === 0)

  useEffect(() => {
    const list = key ? key.split('\n') : []
    if (list.length === 0) {
      setSettled(true)
      return
    }

    setSettled(false)
    let live = true
    let pending = list.length

    const settleOne = () => {
      pending -= 1
      if (live && pending <= 0) setSettled(true)
    }

    const images = list.map((url) => {
      const img = new Image()
      img.onload = () => {
        if (typeof img.decode === 'function') img.decode().then(settleOne, settleOne)
        else settleOne()
      }
      img.onerror = settleOne
      img.src = url
      return img
    })

    return () => {
      live = false
      images.forEach((img) => {
        img.onload = null
        img.onerror = null
      })
    }
  }, [key])

  return settled
}
