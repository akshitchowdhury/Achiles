import clsx from 'clsx'
import { Logo } from '../Logo'
import { PlanNav } from '../PlanNav'
import { PlanUser } from '../PlanUser'
import { SkipLink } from './SkipLink'
import { ShellWatermark } from '../../plans/ShellWatermark'
import type { ShellProps } from './types'

/**
 * spartan · The Stoa — icon rail plus architrave.
 *
 * A 72px icon-only left rail with a 56px ornamented band across the top of the
 * content. Authoritative and narrow: the chrome takes as little room as it can
 * and the content column stays deliberately tight.
 *
 * The rail is icons only, so PlanNav is told labels="sr-only" — it still renders
 * each label for assistive tech and adds aria-label, so the rail is never
 * unlabelled. Sighted users get the icon plus the volt rail marker; there is no
 * hover tooltip, which is a gap worth filling if the icons prove ambiguous.
 */
export function StoaShell({ children }: ShellProps) {
  const item = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'relative flex items-center justify-center rounded-lg py-3 transition-colors',
      isActive ? 'text-volt' : 'text-ink-muted hover:text-ink hover:bg-hover-wash',
    )

  const marker = ({ isActive }: { isActive: boolean }) => (
    <span
      aria-hidden="true"
      className={clsx(
        'bg-volt absolute top-1/2 left-0 h-6 w-0.5 -translate-y-1/2 rounded-r transition-opacity',
        isActive ? 'opacity-100' : 'opacity-0',
      )}
    />
  )

  return (
    <div className="plan-bg relative isolate min-h-svh">
      <SkipLink />
      <ShellWatermark />

      {/* Desktop icon rail */}
      <aside className="border-hairline bg-surface fixed inset-y-0 left-0 z-30 hidden w-18 flex-col items-center border-r py-4 lg:flex">
        <Logo className="text-volt size-6" />
        <PlanNav
          orientation="vertical"
          labels="sr-only"
          className="mt-8 w-full px-3"
          listClassName="gap-2"
          item={item}
          marker={marker}
          iconClassName="size-5"
        />
        <div className="mt-auto">
          <PlanUser compact className="flex-col" />
        </div>
      </aside>

      <div className="lg:pl-18">
        {/* Architrave — chrome, not navigation. */}
        <header className="border-hairline bg-surface sticky top-0 z-20 flex h-14 items-center gap-4 border-b px-4 sm:px-6">
          <div className="lg:hidden">
            <Logo className="text-volt size-5" />
          </div>
          <p className="text-ink-dim tracking-label font-display text-xs font-semibold uppercase">
            Achiles · Spartan
          </p>
          <div className="plan-meander hidden flex-1 sm:block" aria-hidden="true" />
        </header>

        {/* Narrower than the other shells on purpose — a stoa is a colonnade,
            not a plaza. */}
        <main id="main" className="plan-region mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Under lg the rail becomes a bottom bar — no drawer, no hamburger. The
          rail was already icon-first, so it transplants without redesign.

          Both navs sit in the DOM at once, but display:none removes the hidden
          one from the accessibility tree too, so there is never more than one
          "Main" landmark exposed. Do NOT aria-hidden either of them — on mobile
          this bar is the only navigation there is. */}
      <div className="border-hairline bg-surface fixed inset-x-0 bottom-0 z-30 border-t lg:hidden">
        <PlanNav
          orientation="horizontal"
          labels="visible"
          listClassName="items-stretch"
          item={({ isActive }) =>
            clsx(
              'tracking-label flex h-14 flex-col items-center justify-center gap-1 text-[10px] uppercase transition-colors',
              isActive ? 'text-volt bg-hover-wash font-bold' : 'text-ink-muted font-medium',
            )
          }
          // The bottom bar is the ONLY navigation this plan has under lg, so it
          // gets the same non-colour active marker the desktop rail has — a
          // bronze rule plus weight. Colour alone would leave the current route
          // indistinguishable to a colour-blind athlete.
          marker={({ isActive }) => (
            <span
              aria-hidden="true"
              className={clsx(
                'bg-volt absolute inset-x-3 top-0 h-0.5 rounded-b transition-opacity',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}
          iconClassName="size-4"
        />
      </div>
    </div>
  )
}
