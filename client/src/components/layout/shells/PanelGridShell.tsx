import clsx from 'clsx'
import { Logo } from '../Logo'
import { PlanNav } from '../PlanNav'
import { PlanUser } from '../PlanUser'
import { SkipLink } from './SkipLink'
import { ShellWatermark } from '../../plans/ShellWatermark'
import type { ShellProps } from './types'

/**
 * manga · Panel Grid — a right-hand rail of framed panels.
 *
 * The only shell with navigation on the right, because manga reads
 * right-to-left. Each nav item is its own bordered panel separated by ink
 * gutters, so the rail reads as a strip of frames rather than a list. The active
 * item fully inverts, which is the highest-contrast active state in the set and
 * never depends on hue.
 *
 * DOM order stays Home → Nutrition → Workout → Panel regardless of the mirrored
 * placement, so tab order still matches reading order.
 */
export function PanelGridShell({ children }: ShellProps) {
  const item = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex flex-col items-center justify-center gap-1 border-2 py-3 text-[9px] font-bold uppercase transition-colors',
      'tracking-label',
      isActive
        ? 'bg-ink text-plane border-ink'
        : 'border-hairline-strong text-ink-dim hover:text-ink hover:border-ink',
    )

  return (
    <div className="plan-bg relative isolate min-h-svh">
      <SkipLink />
      <ShellWatermark />

      {/* Desktop right rail */}
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-22 flex-col gap-3 p-3 lg:flex">
        <div className="border-hairline-strong flex h-14 items-center justify-center border-2">
          <Logo className="text-volt size-5" />
        </div>
        <PlanNav
          orientation="vertical"
          labels="visible"
          listClassName="gap-3"
          item={item}
          iconClassName="size-4"
        />
        <div className="border-hairline-strong mt-auto flex items-center justify-center border-2 p-1">
          <PlanUser compact className="flex-col" />
        </div>
      </aside>

      <div className="lg:pr-22">
        {/* Panel number strip — the frame caption of a manga page. */}
        <div
          aria-hidden="true"
          className="text-ink-muted tracking-label px-4 pt-4 text-[10px] font-bold uppercase italic sm:px-6"
        >
          ╱ 01 ╱ Achiles ╱ Manga arc
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
      <div className="bg-plane fixed inset-x-0 bottom-0 z-30 p-2 lg:hidden">
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
