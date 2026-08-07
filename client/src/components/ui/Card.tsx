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
      <div className="min-w-0">
        {/* No font utilities — .plan-card-title owns family, size, weight and
            case so each plan can set its own. The hint stays in the body face
            deliberately: it is the line that explains what a figure means, and
            it must stay readable in every theme. */}
        <h2 className="plan-card-title text-ink">{title}</h2>
        {hint && <p className="text-ink-muted font-sans mt-1 text-xs">{hint}</p>}
      </div>
      {action}
    </header>
  )
}
