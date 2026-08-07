import clsx from 'clsx'
import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { NAV_ITEMS } from './navigation'

interface NavState {
  isActive: boolean
}

interface PlanNavProps {
  orientation: 'vertical' | 'horizontal'
  /** 'sr-only' still renders the label for assistive tech and adds aria-label,
   *  so an icon-only rail can never ship unlabelled. */
  labels: 'visible' | 'sr-only'
  className?: string
  listClassName?: string
  /** The shell supplies the skin. */
  item: (state: NavState) => string
  /** The shell supplies its own active marker — a rail, an underline, an
   *  inversion — so the active state never rests on colour alone. */
  marker?: (state: NavState) => ReactNode
  /** Icon size class, since a dock and a rail want different weights. */
  iconClassName?: string
  onNavigate?: () => void
}

/**
 * The one component that renders NAV_ITEMS, in every shell.
 *
 * Centralising it is an accessibility decision, not a DRY one: tab order, the
 * <nav> landmark, `end` matching on the index route, aria-current, focus-visible
 * and the never-colour-alone active marker are implemented once here and
 * inherited by all five layouts. A shell can restyle the nav but cannot
 * accidentally ship one that is unreachable or unlabelled.
 */
export function PlanNav({
  orientation,
  labels,
  className,
  listClassName,
  item,
  marker,
  iconClassName = 'size-4',
  onNavigate,
}: PlanNavProps) {
  return (
    <nav aria-label="Main" className={className}>
      <ul
        className={clsx(
          'flex',
          orientation === 'vertical' ? 'flex-col' : 'flex-row',
          listClassName,
        )}
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to} className={orientation === 'horizontal' ? 'min-w-0 flex-1' : undefined}>
            <NavLink
              to={to}
              end={to === '/'}
              onClick={onNavigate}
              // Redundant with the accessible name from the label when labels
              // are visible, but harmless — and essential when they are not.
              aria-label={labels === 'sr-only' ? label : undefined}
              // font-label here rather than in each shell's `item` skin: the
              // nav is chrome, and chrome speaks in the plan's label face in
              // all five layouts. A shell must NOT also set a font utility on
              // its item — two font-family utilities are the same specificity
              // in the same layer, so which one wins would come down to the
              // order Tailwind happened to emit them in.
              className={({ isActive }) => clsx('group/nav font-label relative', item({ isActive }))}
            >
              {({ isActive }) => (
                <>
                  {marker?.({ isActive })}
                  <Icon className={clsx('shrink-0', iconClassName)} aria-hidden="true" />
                  <span className={labels === 'sr-only' ? 'sr-only' : undefined}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
