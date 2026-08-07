import clsx from 'clsx'
import { useLocation } from 'react-router-dom'
import { Logo } from '../Logo'
import { NAV_ITEMS } from '../navigation'
import { PlanNav } from '../PlanNav'
import { PlanUser } from '../PlanUser'
import { SkipLink } from './SkipLink'
import { ShellWatermark } from '../../plans/ShellWatermark'
import type { ShellProps } from './types'

/**
 * superhero · Command Deck — HUD strip and a floating dock.
 *
 * Navigation is a frosted pill floating at the bottom centre, thumb-first at
 * every width, so this is the one shell that needs no responsive nav rework.
 * A 28px status strip runs along the top; it mirrors the nav's current route as
 * decoration and is aria-hidden, because the real thing is three lines below it.
 */
export function CommandDeckShell({ children }: ShellProps) {
  const { pathname } = useLocation()
  const current = NAV_ITEMS.find((nav) =>
    nav.to === '/' ? pathname === '/' : pathname.startsWith(nav.to),
  )

  const item = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-[10px] tracking-label uppercase transition-colors sm:px-4',
      isActive ? 'bg-accent-wash text-volt' : 'text-ink-muted hover:text-ink',
    )

  const marker = ({ isActive }: { isActive: boolean }) => (
    <span
      aria-hidden="true"
      className={clsx(
        'bg-volt absolute inset-x-2 bottom-0.5 h-0.5 rounded-full transition-opacity',
        isActive ? 'opacity-100' : 'opacity-0',
      )}
    />
  )

  return (
    <div className="plan-bg relative isolate min-h-svh">
      <SkipLink />
      <ShellWatermark />

      {/* HUD status strip. Decoration mirroring the nav, hence aria-hidden. */}
      <div
        aria-hidden="true"
        className="border-hairline bg-surface-translucent relative flex h-7 items-center justify-between overflow-hidden border-b px-4 text-[10px] backdrop-blur"
      >
        <span className="text-ink-muted font-label tracking-label flex items-center gap-2 uppercase">
          <Logo className="text-volt size-3.5" />
          Achiles · SPEC-04
        </span>
        <span className="text-ink-muted font-label tracking-label flex items-center gap-2 uppercase">
          <span className="bg-volt plan-pulse size-1.5 rounded-full" />
          {current?.label ?? 'Deck'}
        </span>
        {/* Scanner sweep, killed by the reduced-motion rule in plan-shells.css. */}
        <span className="plan-sweep via-accent-wash pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent to-transparent" />
      </div>

      <main
        id="main"
        className="plan-region plan-brackets relative mx-auto max-w-6xl px-4 py-8 pb-32 sm:px-6"
      >
        {children}
      </main>

      {/* The dock. Bottom-centre on desktop, full-width on the smallest screens
          so all four targets stay past 44px. */}
      <div className="fixed inset-x-3 bottom-4 z-40 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2">
        <div className="border-accent-edge bg-surface-translucent shadow-overlay flex items-center gap-1 rounded-2xl border px-2 py-1.5 backdrop-blur-xl">
          <PlanNav
            orientation="horizontal"
            labels="visible"
            listClassName="items-stretch gap-1"
            item={item}
            marker={marker}
            iconClassName="size-4"
          />
          <span className="bg-hairline-strong mx-1 h-8 w-px" aria-hidden="true" />
          <PlanUser compact />
        </div>
      </div>
    </div>
  )
}
