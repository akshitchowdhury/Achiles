import clsx from 'clsx'
import { Logo } from '../Logo'
import { PlanNav } from '../PlanNav'
import { PlanUser } from '../PlanUser'
import { SkipLink } from './SkipLink'
import { ShellWatermark } from '../../plans/ShellWatermark'
import { CursedSeal, Shuriken } from '../../icons/AnimeGlyphs'
import type { ShellProps } from './types'

/**
 * manga · Sealed Ground — a right-hand rail of rune panels.
 *
 * Still the only shell with navigation on the right, because the plan reads
 * right-to-left. What changed is what the panels are made of: they were inked
 * comic frames with 3px black borders, and they are now glass slabs on a
 * violet edge, sitting over a struck arcane circle. The layout is untouched —
 * this is a reskin of the same structure, not a new one.
 *
 * The active state still fully inverts to a solid fill. That is deliberate and
 * survives the restyle: on a theme this dark, a glowing border alone is a hue
 * cue, and the rail must stay readable to someone who cannot see the hue. Fill
 * versus no-fill is a luminance change, so it works either way.
 *
 * DOM order stays Home → Nutrition → Workout → Panel regardless of the
 * mirrored placement, so tab order still matches reading order.
 */
export function PanelGridShell({ children }: ShellProps) {
  const item = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex flex-col items-center justify-center gap-1 border py-3 text-[9px] font-semibold uppercase transition-all',
      'tracking-label rounded-lg',
      isActive
        ? 'bg-volt text-on-accent border-volt'
        : 'border-accent-edge-soft text-ink-dim hover:text-ink hover:border-accent-edge bg-surface-translucent backdrop-blur-sm',
    )

  return (
    <div className="plan-bg relative isolate min-h-svh">
      <SkipLink />
      <ShellWatermark />

      {/* Desktop right rail */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-22 flex-col gap-3 p-3 lg:flex">
        <div className="border-accent-edge-soft bg-surface-translucent relative flex h-14 items-center justify-center rounded-lg border backdrop-blur-sm">
          {/* The seal turns slowly behind the wordmark. Decorative, so it is
              hidden from AT and stopped outright under reduced motion — the
              rule lives with the other decorative animations in
              plan-shells.css rather than here. */}
          <CursedSeal
            aria-hidden="true"
            className="plan-seal-spin text-volt absolute size-10 opacity-20"
          />
          <Logo className="text-volt relative size-5" />
        </div>

        <PlanNav
          orientation="vertical"
          labels="visible"
          listClassName="gap-3"
          item={item}
          iconClassName="size-4"
        />

        <div className="border-accent-edge-soft bg-surface-translucent mt-auto flex items-center justify-center rounded-lg border p-1 backdrop-blur-sm">
          <PlanUser compact className="flex-col" />
        </div>
      </aside>

      <div className="lg:pr-22">
        {/* Status-window header. Decoration mirroring nothing, hence
            aria-hidden — the page's own masthead carries the real heading. */}
        <div
          aria-hidden="true"
          className="flex items-center gap-2.5 px-4 pt-4 sm:px-6"
        >
          <Shuriken className="text-volt size-3.5 shrink-0 opacity-80" />
          <span className="text-ink-muted font-label tracking-label text-[10px] font-semibold uppercase">
            Achiles · sealed ground
          </span>
          <span className="text-volt/45 plan-ink-rule min-w-0 flex-1" />
        </div>

        <main
          id="main"
          className="plan-region mx-auto max-w-6xl space-y-3 px-4 py-5 pb-28 sm:px-6 lg:pb-8"
        >
          {children}
        </main>
      </div>

      {/* Under lg the rail becomes a bottom strip of the same panels. Visual
          order flips to left-to-right, matching DOM and tab order. */}
      <div className="bg-plane/85 fixed inset-x-0 bottom-0 z-30 p-2 backdrop-blur lg:hidden">
        <PlanNav
          orientation="horizontal"
          labels="visible"
          listClassName="gap-2"
          item={item}
          iconClassName="size-4"
        />
      </div>
    </div>
  )
}
