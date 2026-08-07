import clsx from 'clsx'
import { LogOut } from 'lucide-react'
import { initials } from '../../lib/format'
import { useSignOut } from '../../hooks/useAuth'
import { useSession } from '../../store/session'

interface PlanUserProps {
  /** Avatar only, for shells that squeeze the athlete into a bar or a dock. */
  compact?: boolean
  className?: string
}

/**
 * Athlete identity plus sign-out, shared by every shell.
 *
 * Lifted out of the old Sidebar so there is exactly one useSignOut call site —
 * signing out has to clear both the Google cookie and the local session, and
 * five copies of that is five chances to get it wrong.
 */
export function PlanUser({ compact = false, className }: PlanUserProps) {
  const name = useSession((s) => s.name)
  const userId = useSession((s) => s.userId)
  const email = useSession((s) => s.email)
  const picture = useSession((s) => s.picture)
  const signOut = useSignOut()

  const label = name ?? 'Guest'
  const detail = email ?? `Athlete #${userId}`

  // alt=""/aria-hidden is right in the full layout, where the name and email sit
  // beside the avatar as real text. In the compact form there is no such text,
  // so the avatar has to carry the name itself or the signed-in identity is
  // invisible to assistive tech.
  const avatar = picture ? (
    <img
      src={picture}
      alt={compact ? label : ''}
      referrerPolicy="no-referrer"
      className="size-9 shrink-0 rounded-full object-cover"
    />
  ) : (
    <span
      role={compact ? 'img' : undefined}
      aria-label={compact ? label : undefined}
      aria-hidden={compact ? undefined : true}
      className="bg-accent-wash text-volt flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
    >
      {initials(name ?? '')}
    </span>
  )

  if (compact) {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        {avatar}
        <span className="sr-only">{detail}</span>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          aria-label="Sign out"
          className="text-ink-muted hover:bg-hover-wash hover:text-ink rounded-lg p-2 transition-colors disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-2 py-2">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate text-sm font-medium">{label}</p>
          <p className="text-ink-muted truncate text-xs">{detail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => signOut.mutate()}
        disabled={signOut.isPending}
        className="text-ink-muted hover:bg-hover-wash hover:text-ink mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors disabled:opacity-50"
      >
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  )
}
