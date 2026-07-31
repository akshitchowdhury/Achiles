import clsx from 'clsx'
import { CircleAlert, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('bg-raised animate-pulse rounded-xl', className)} />
}

export function LoadingPanel({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      role="status"
      className="text-ink-muted flex items-center justify-center gap-2 py-16 text-sm"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}

interface ErrorPanelProps {
  title?: string
  message: string
  action?: ReactNode
}

export function ErrorPanel({ title = 'Something went wrong', message, action }: ErrorPanelProps) {
  return (
    <div className="border-critical/30 bg-critical/5 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <CircleAlert className="text-critical mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-ink text-sm font-semibold">{title}</p>
          <p className="text-ink-dim mt-1 text-sm break-words">{message}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  title: string
  message: string
  action?: ReactNode
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="border-hairline flex flex-col items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <p className="text-ink text-sm font-semibold">{title}</p>
      <p className="text-ink-dim mt-1 max-w-sm text-sm">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
