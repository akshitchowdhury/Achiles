import clsx from 'clsx'
import { LogOut } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from './navigation'
import { Wordmark } from './Logo'
import { initials } from '../../lib/format'
import { useSignOut } from '../../hooks/useAuth'
import { useSession } from '../../store/session'

interface SidebarProps {
  /** Mobile drawer only — closes the drawer after a nav choice. */
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const name = useSession((s) => s.name)
  const userId = useSession((s) => s.userId)
  const email = useSession((s) => s.email)
  const picture = useSession((s) => s.picture)
  // Clears the Google session cookie as well as the local athlete id.
  const signOut = useSignOut()

  return (
    <div className="border-hairline bg-surface flex h-full w-64 flex-col border-r">
      <div className="border-hairline flex h-16 items-center border-b px-5">
        <Wordmark />
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-raised text-ink font-medium'
                  : 'text-ink-dim hover:bg-raised/60 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Active state carries a volt rail as well as weight/colour,
                    so it never depends on colour alone. */}
                <span
                  className={clsx(
                    'bg-volt absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r transition-opacity',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden="true"
                />
                <Icon
                  className={clsx('size-4 shrink-0', isActive ? 'text-volt' : 'text-ink-muted')}
                  aria-hidden="true"
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-hairline border-t p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          {picture ? (
            <img
              src={picture}
              alt=""
              referrerPolicy="no-referrer"
              className="size-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-volt/15 text-volt flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            >
              {initials(name ?? '')}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-sm font-medium">{name ?? 'Guest'}</p>
            <p className="text-ink-muted truncate text-xs">{email ?? `Athlete #${userId}`}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="text-ink-muted hover:bg-raised hover:text-ink mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors disabled:opacity-50"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  )
}
