import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useDecodedImage } from '../../hooks/useDecodedImage'
import { visualFor } from './planVisual'
import { PLAN_LAYOUTS } from '../../theme/registry'
import type { PlanSlug, TrainingPlan } from '../../types'

/* Barrel geometry. Derived once, here, so the numbers can be checked:
 *   sweep 56° over 14 facets  → 4°/facet
 *   R = pitch / (2·sin(2°))    ≈ 14.3 × pitch
 *   at a 248px card: pitch 17.7px, R 254px, depth R(1−cos28°) ≈ 30px
 * against perspective: 900px — a long focal length, so the curve comes from
 * the geometry rather than from a fisheye.
 *
 * Sweep is capped at 56° on purpose: compression is worst at both edges, so a
 * wider sweep would warp any subject not sitting in the flat middle third. */
const SWEEP_DEG = 56
const FACETS = 14
const FACET_DEG = SWEEP_DEG / FACETS
/** Facets are drawn 2px wide of their pitch and offset back by 1px, so
 *  neighbours overlap rather than butt. Butted facets leave AA hairlines;
 *  preserve-3d depth-sorts, and centre facets sit nearer the camera, so they
 *  paint over their flanking neighbours and the bleed is invisible. There is
 *  no scaleX involved, so the sampled region is never stretched. */
const BLEED = 1

interface Box {
  w: number
  h: number
}

/** Integer px only: the facet strip maths needs whole pixels, and rounding here
 *  suppresses the churn a fractional container resize would otherwise cause. */
function useBoxSize(ref: React.RefObject<HTMLElement | null>): Box {
  const [box, setBox] = useState<Box>({ w: 0, h: 0 })

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      const h = Math.round(entry.contentRect.height)
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return box
}

interface PlanCylinderCardProps {
  plan: TrainingPlan
  slug: PlanSlug
  selected: boolean
  /** Roving tabindex — exactly one card in the group is tabbable. */
  tabbable: boolean
  /** True while the sweep circuit-breaker is suppressing screen previews, so
   *  the card shows its own palette chips instead. */
  showChips: boolean
  onSelect: () => void
  onPreview: () => void
  onRevert: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
  registerRef: (node: HTMLButtonElement | null) => void
}

export function PlanCylinderCard({
  plan,
  slug,
  selected,
  tabbable,
  showChips,
  onSelect,
  onPreview,
  onRevert,
  onKeyDown,
  registerRef,
}: PlanCylinderCardProps) {
  const reduce = useReducedMotion()
  const boxRef = useRef<HTMLDivElement>(null)
  const box = useBoxSize(boxRef)
  const image = useDecodedImage(plan.image_url)
  const visual = visualFor(slug)
  const Crest = visual.crest

  // Touch devices take the flat path for layer-budget reasons: 5 cards × 14
  // facets on a snap rail exceeds what iOS Safari keeps composited, and it
  // falls back to software raster. (hover: none) is a coarse proxy — a stylus
  // tablet reports both — but erring toward flat only costs some depth.
  const [coarse, setCoarse] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(hover: none)')
    setCoarse(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const flat = reduce || coarse

  // One animated transform per card, on the barrel. The facets' own transforms
  // are static strings that motion never touches.
  const rotateY = useSpring(0, { stiffness: 260, damping: 26, mass: 0.6 })
  const spec = useMotionValue(0.38)
  const faceX = useSpring(0, { stiffness: 200, damping: 30 })

  const facets = useMemo(() => {
    if (flat || box.w === 0 || box.h === 0) return null

    const pitch = box.w / FACETS
    const radius = pitch / (2 * Math.sin((FACET_DEG / 2) * (Math.PI / 180)))

    // `cover`, reimplemented against the BARREL box. background-size: cover on
    // a facet computes against that 19px sliver and blows the image up per
    // slice, which looks like garbage.
    const hasPhoto = image.src != null && image.width > 0
    const scale = hasPhoto
      ? Math.max(box.w / image.width, box.h / image.height)
      : 1
    const bgW = hasPhoto ? image.width * scale : box.w
    const bgH = hasPhoto ? image.height * scale : box.h
    // 0.35 rather than 0.5 biases the crop upward, keeping heads in frame.
    const offX = (box.w - bgW) / 2
    const offY = hasPhoto ? (box.h - bgH) * 0.35 : 0

    return Array.from({ length: FACETS }, (_, i) => {
      const angle = (i - (FACETS - 1) / 2) * FACET_DEG
      return (
        <div
          key={i}
          className="cyl-facet"
          style={
            {
              '--cyl-r': radius.toFixed(2),
              '--facet-a': angle.toFixed(3),
              '--facet-w': `${(pitch + BLEED * 2).toFixed(2)}px`,
              backgroundImage: hasPhoto ? `url("${image.src}")` : visual.gradient,
              backgroundSize: `${bgW.toFixed(2)}px ${bgH.toFixed(2)}px`,
              backgroundPosition: `${(offX - (i * pitch - BLEED)).toFixed(2)}px ${offY.toFixed(2)}px`,
            } as React.CSSProperties
          }
        />
      )
    })
  }, [flat, box.w, box.h, image.src, image.width, image.height, visual.gradient])

  function trackPointer(event: React.PointerEvent<HTMLButtonElement>) {
    if (flat) return
    const rect = event.currentTarget.getBoundingClientRect()
    const t = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    // ±4.5°: enough to feel like a surface turning, not enough to warp the
    // photo or expose the barrel's ends.
    rotateY.set((t - 0.5) * 9)
    spec.set(0.15 + t * 0.7)
    faceX.set((t - 0.5) * -10)
  }

  function resetPointer() {
    rotateY.set(0)
    spec.set(0.38)
    faceX.set(0)
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      ref={registerRef}
      // The photo conveys nothing about which plan to choose; the name and
      // description are the whole decision. So the accessible name is the text,
      // and the barrel — being a background-image — is invisible to AT anyway.
      aria-label={`${plan.name} — ${plan.description}`}
      className={clsx('cyl-item group', selected && 'is-selected')}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onPointerEnter={onPreview}
      onPointerMove={trackPointer}
      onPointerLeave={() => {
        resetPointer()
        onRevert()
      }}
      onFocus={onPreview}
      onBlur={resetPointer}
    >
      <motion.div
        ref={boxRef}
        className="cyl aspect-[31/44] w-full"
        whileHover={flat ? undefined : { scale: 1.035, y: -6 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {flat ? (
          <div
            className="cyl-flat"
            style={{
              backgroundImage: image.src ? `url("${image.src}")` : visual.gradient,
            }}
          />
        ) : (
          <motion.div className="cyl-barrel" style={{ rotateY }}>
            {facets}
          </motion.div>
        )}

        <motion.div className="cyl-shade" style={{ '--spec': spec } as React.CSSProperties} />

        <motion.div className="cyl-face" style={{ x: flat ? 0 : faceX }}>
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-base leading-tight font-semibold text-white">
              {plan.name}
            </p>
            {selected ? (
              <span className="bg-volt text-on-accent flex size-5 shrink-0 items-center justify-center rounded-full">
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              </span>
            ) : (
              <Crest className="size-4 shrink-0 text-white/55" aria-hidden="true" />
            )}
          </div>

          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-white/70">
            {plan.description}
          </p>

          {/* Stand-in for the screen preview while the breaker is cooling
              down, so a scanning pointer still gets colour information. */}
          {showChips && (
            <div className="mt-2.5 flex gap-1" aria-hidden="true">
              {visual.chips.map((chip) => (
                <span
                  key={chip}
                  className="size-2 rounded-full ring-1 ring-black/40"
                  style={{ background: chip }}
                />
              ))}
            </div>
          )}

          <p className="mt-2 text-[10px] tracking-[0.14em] text-white/45 uppercase">
            {PLAN_LAYOUTS[slug].label}
          </p>
        </motion.div>

        {/* Selection ring. On the wrapper rather than the button so it hugs the
            card's own corner radius. */}
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none absolute inset-0 rounded-[inherit] transition-all',
            selected ? 'ring-volt ring-2 ring-inset' : 'ring-0',
          )}
        />
      </motion.div>
    </button>
  )
}
