import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <p className="text-ink-muted text-xs font-medium tracking-wide uppercase">{eyebrow}</p>
        <h1 className="text-ink mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-ink-dim mt-2 text-sm">{description}</p>}
      </div>
      {action}
    </header>
  )
}
