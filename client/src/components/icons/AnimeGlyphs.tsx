import type { ReactNode, SVGProps } from 'react'

/**
 * The glyphs the manga plan needs and lucide does not have.
 *
 * A shuriken, an arcane seal, a katana, claw marks, an obsidian shard and a
 * paper ward: none of these exist in an icon set built for dashboards, and
 * substituting lucide's nearest neighbour is what made the old manga plan read
 * as "the dark one" rather than as its own thing.
 *
 * Drawn to lucide's conventions on purpose — 24×24 box, `none` fill,
 * currentColor stroke at 2, round caps and joins — so they sit in the same row
 * as Ruler and Droplets without one of them looking imported from elsewhere.
 * That also means every existing `size-*`, `text-*` and `aria-hidden` call site
 * keeps working untouched.
 *
 * These are original geometry: stars, rings, blades and slashes are the common
 * vocabulary of the genre, not any studio's mark. Nothing here traces a
 * specific character's design, which is the same line the source spec draws.
 */

const BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  // Presentation attributes, so any `size-*` class still wins — CSS outranks
  // these. Without them an unclassed instance would fall back to the SVG
  // replaced-element default of 300×150.
  width: 24,
  height: 24,
}

function Glyph({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg {...BASE} {...props}>
      {children}
    </svg>
  )
}

/** Four-point throwing star with an open centre. */
export function Shuriken(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 1.8 14.3 9.7 22.2 12 14.3 14.3 12 22.2 9.7 14.3 1.8 12 9.7 9.7Z" />
      <circle cx="12" cy="12" r="1.7" />
    </Glyph>
  )
}

/** Arcane circle — outer ring, inner ring, four cardinal ticks. */
export function CursedSeal(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 1.4v3.2M12 19.4v3.2M1.4 12h3.2M19.4 12h3.2" />
    </Glyph>
  )
}

/** Cursed energy — a flame wrapped in two aura wisps. */
export function AuraFlame(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 22c3.6 0 6-2.4 6-5.7 0-3.8-3.4-5.5-3.4-9.1 0-1.6.6-2.8 1.2-3.6-4 .9-8 4.2-8 9.1 0 1.5.6 2.6 1.3 3.4-1 .1-2 .8-2 2.3C7.1 20.4 9.2 22 12 22Z" />
      <path d="M3.4 6.6c-.7 1.5-1 3-.9 4.6M20.6 6.6c.7 1.5 1 3 .9 4.6" />
    </Glyph>
  )
}

/** Katana — curved blade, guard, wrapped handle. */
export function Katana(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M7.6 16.9C11.2 13.4 16.7 7.9 21.6 2.6" />
      <path d="M9.6 18.9c3.4-3.3 8.6-8.6 11.4-13.6" strokeWidth="1.2" opacity=".55" />
      <path d="M5.4 16.2 8.8 19.6" />
      <path d="M2.4 21.6 6 18" strokeWidth="2.6" />
    </Glyph>
  )
}

/** Three tapering claw marks — the tribal slash. */
export function ClawMark(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M3.4 2.6C7 7.2 10.6 13.4 12.4 21.4" />
      <path d="M9.2 1.8c3.4 4.4 6.6 10.2 8.2 17.6" strokeWidth="1.6" />
      <path d="M15.4 2.8c2.8 3.6 5.2 7.8 6.6 12.2" strokeWidth="1.2" />
    </Glyph>
  )
}

/** Obsidian shard, cut and faceted. */
export function Obsidian(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M12 1.8 20.4 8.6 15.6 22.2H8.4L3.6 8.6Z" />
      <path d="M3.6 8.6h16.8M12 1.8l3.6 20.4M12 1.8 8.4 22.2" strokeWidth="1.2" opacity=".6" />
    </Glyph>
  )
}

/** Paper ward — a hanging talisman with its seal strokes. */
export function Talisman(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M7.8 4.2 12 1.6l4.2 2.6v18H7.8Z" />
      <path d="M10.2 8.4h3.6M10.2 12h3.6M12 15v3.4" strokeWidth="1.5" />
    </Glyph>
  )
}

/** Moon over still water — the plan's hydration mark. */
export function MoonTide(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph {...props}>
      <path d="M17.4 2.6a7.6 7.6 0 1 0 4 8.4 6.2 6.2 0 0 1-4-8.4Z" />
      <path d="M2.4 17.4c1.6 0 1.6 1.4 3.2 1.4s1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4 1.6-1.4 3.2-1.4 1.6 1.4 3.2 1.4M2.4 21.2c1.6 0 1.6 1.4 3.2 1.4" />
    </Glyph>
  )
}
