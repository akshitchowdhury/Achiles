import clsx from 'clsx'
import { Logo } from '../Logo'
import { PlanNav } from '../PlanNav'
import { PlanUser } from '../PlanUser'
import { SkipLink } from './SkipLink'
import { ShellWatermark } from '../../plans/ShellWatermark'
import type { ShellProps } from './types'

/**
 * greek-god · The Peristyle — centred entablature and fluted pillars.
 *
 * The only shell with no side rail at all, and the only light one. Navigation is
 * a centred two-row entablature; the content sits in a wide, generously spaced
 * court flanked by decorative pillars.
 *
 * The pillars are `hidden xl:block` — decorative chrome that disappears before
 * it can steal width, which is precisely why it belongs to the shell rather than
 * to any page.
 */
export function PeristyleShell({ children }: ShellProps) {
  const item = ({ isActive }: { isActive: boolean }) =>
    clsx(
      // No font utility: PlanNav sets font-label on every item.
      'flex items-center gap-1.5 px-3 py-2 text-sm tracking-wide transition-colors',
      isActive ? 'text-ink font-semibold' : 'text-ink-dim hover:text-ink',
    )

  const marker = ({ isActive }: { isActive: boolean }) => (
    <span
      aria-hidden="true"
      className={clsx(
        'bg-volt absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full transition-opacity',
        isActive ? 'opacity-100' : 'opacity-0',
      )}
    />
  )

  return (
    <div className="plan-bg relative isolate min-h-svh">
      <SkipLink />
      <ShellWatermark />

      <header className="border-hairline bg-surface-translucent sticky top-0 z-20 border-b backdrop-blur">
        {/* Row 1 — wordmark between two gold hairlines running to the edges. */}
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pt-4 sm:px-8">
          <span className="border-accent-edge-soft hidden flex-1 border-t sm:block" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <Logo className="text-volt size-5" />
            <span className="text-ink font-label tracking-label text-sm font-semibold uppercase">
              Achiles
            </span>
          </div>
          <span className="border-accent-edge-soft hidden flex-1 border-t sm:block" aria-hidden="true" />
          <PlanUser compact className="ml-auto sm:ml-0" />
        </div>

        {/* Row 2 — the nav itself, centred, scrollable when it must be. */}
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <PlanNav
            orientation="horizontal"
            labels="visible"
            className="overflow-x-auto"
            // justify-start below sm: inside an overflow-x-auto row, centred
            // content that is wider than the box overflows to the LEFT, past
            // scrollLeft: 0, making the first item permanently unreachable on a
            // phone. Centring only kicks in once the row fits.
            listClassName="justify-start gap-1 py-2 sm:justify-center [&>li]:flex-none"
            item={item}
            marker={marker}
            iconClassName="size-3.5"
          />
        </div>
      </header>

      <div className="relative mx-auto flex max-w-7xl">
        <div className="plan-pillar hidden w-10 shrink-0 xl:block" aria-hidden="true" />

        <main
          id="main"
          className="plan-region mx-auto w-full max-w-5xl px-4 py-14 sm:px-8 lg:py-20"
        >
          {children}
        </main>

        <div className="plan-pillar hidden w-10 shrink-0 xl:block" aria-hidden="true" />
      </div>
    </div>
  )
}
