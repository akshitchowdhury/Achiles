import clsx from 'clsx'
import { Logo } from '../Logo'
import { PlanNav } from '../PlanNav'
import { PlanUser } from '../PlanUser'
import { SkipLink } from './SkipLink'
import { ShellWatermark } from '../../plans/ShellWatermark'
import type { ShellProps } from './types'

/**
 * athlete · Broadcast — scoreboard bar and a diagonal hero band.
 *
 * A 64px sticky scoreboard across the top with bold uppercase tabs and the
 * athlete treated as the competitor card on the right. No side rail at any
 * width. The clipped diagonal band under the bar is what the content sits over,
 * so the first card reads as overlapping the graphic.
 */
export function BroadcastShell({ children }: ShellProps) {
  const item = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'relative flex h-16 items-center gap-2 px-4 text-sm font-bold uppercase transition-colors',
      'tracking-label whitespace-nowrap',
      isActive ? 'text-ink bg-hover-wash' : 'text-ink-dim hover:text-ink',
    )

  const marker = ({ isActive }: { isActive: boolean }) => (
    <span
      aria-hidden="true"
      className={clsx(
        'bg-volt absolute inset-x-0 bottom-0 h-[3px] transition-opacity',
        isActive ? 'opacity-100' : 'opacity-0',
      )}
    />
  )

  return (
    <div className="plan-bg relative isolate min-h-svh">
      <SkipLink />
      <ShellWatermark />

      <header className="border-hairline-strong bg-plane sticky top-0 z-30 flex h-16 items-center border-b">
        <div className="flex h-full shrink-0 items-center gap-2 px-4">
          <Logo className="text-volt size-5" />
          <span className="text-ink font-label tracking-label hidden text-sm font-bold uppercase sm:block">
            Achiles
          </span>
        </div>

        {/* Below md the tabs scroll-snap inside the bar rather than wrapping —
            a scoreboard does not get taller. */}
        <PlanNav
          orientation="horizontal"
          labels="visible"
          className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          listClassName="h-full snap-x [&>li]:flex-none"
          item={item}
          marker={marker}
          iconClassName="size-4"
        />

        <div className="shrink-0 px-3">
          <PlanUser compact />
        </div>
      </header>

      {/* Diagonal hero band. Decorative; the content overlaps it. */}
      <div
        aria-hidden="true"
        className="from-volt/18 to-volt/0 h-28 bg-linear-to-r"
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 58%, 0 100%)' }}
      />

      <main
        id="main"
        className="plan-region mx-auto -mt-20 max-w-7xl px-4 pb-12 sm:px-6"
      >
        {children}
      </main>
    </div>
  )
}
