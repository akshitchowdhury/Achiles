import clsx from 'clsx'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <section
      className={clsx(
        // min-w-0: as a grid/flex child the default min-width:auto would let
        // wide contents (charts) push the page into horizontal scroll.
        'border-hairline bg-surface min-w-0 rounded-2xl border p-5',
        className,
      )}
    >
      {children}
    </section>
  )
}

interface CardHeaderProps {
  title: string
  /** Short clarifier under the title — say if a figure is an estimate. */
  hint?: string
  action?: ReactNode
}

export function CardHeader({ title, hint, action }: CardHeaderProps) {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-ink font-display text-sm font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-ink-muted mt-0.5 text-xs">{hint}</p>}
      </div>
      {action}
    </header>
  )
}
