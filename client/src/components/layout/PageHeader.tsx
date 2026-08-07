import type { ReactNode } from 'react'
import { useSession } from '../../store/session'
import { motifFor } from '../../theme/planMotif'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

/**
 * Every page's masthead.
 *
 * The caption strip above the eyebrow comes from the plan motif rather than
 * from the page, so all four routes are stamped with the same signature —
 * standing orders, a file marking, a matchday line, a frame number. It is
 * decoration and says nothing the eyebrow and title do not, hence aria-hidden;
 * a screen reader gets the real heading and skips the rank slug.
 *
 * The eyebrow and title carry no font utilities: .plan-eyebrow and .plan-title
 * own family, size, weight and case so a plan can set its masthead in carved
 * Roman capitals or a broadcast italic without touching a page.
 */
export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  const planSlug = useSession((s) => s.planSlug)
  const { copy } = motifFor(planSlug)

  return (
    <header className="space-y-3">
      <p className="plan-banner" aria-hidden="true">
        {copy.banner}
      </p>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="plan-eyebrow text-ink-muted">{eyebrow}</p>
          <h1 className="plan-title text-ink mt-1.5">{title}</h1>
          {description && <p className="text-ink-dim mt-2 text-sm">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}
