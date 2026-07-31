import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Wordmark } from './Logo'
import { useSession } from '../../store/session'

/** Redirects to the entry screen when there's no stored user id. */
export function AppShell() {
  const userId = useSession((s) => s.userId)
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Route changes should never leave the mobile drawer hanging open.
  useEffect(() => setDrawerOpen(false), [location.pathname])

  if (userId == null) {
    return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="bg-plane min-h-svh">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="bg-plane/80 absolute inset-0 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="border-hairline bg-surface/80 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur lg:hidden">
          {/* Opens only — the drawer's own overlay sits above this bar and
              handles dismissal. */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            className="text-ink-dim hover:text-ink hover:bg-raised -ml-1 rounded-xl p-2 transition-colors"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Wordmark />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
