import clsx from 'clsx'
import { AlertTriangle, CircleAlert, CircleCheck, Minus, TrendingDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Tone } from '../../lib/fitness'

/**
 * Status colours are only ever used one at a time, and always paired with an
 * icon and a text label — colour never carries the meaning on its own.
 */
const TONES: Record<Tone, { text: string; ring: string; dot: string; Icon: LucideIcon }> = {
  good: { text: 'text-good', ring: 'ring-good/30', dot: 'bg-good', Icon: CircleCheck },
  warning: { text: 'text-warning', ring: 'ring-warning/30', dot: 'bg-warning', Icon: TrendingDown },
  serious: { text: 'text-serious', ring: 'ring-serious/30', dot: 'bg-serious', Icon: AlertTriangle },
  critical: { text: 'text-critical', ring: 'ring-critical/30', dot: 'bg-critical', Icon: CircleAlert },
  neutral: { text: 'text-ink-dim', ring: 'ring-hairline-strong', dot: 'bg-ink-muted', Icon: Minus },
}

interface StatusBadgeProps {
  tone: Tone
  label: string
  className?: string
}

export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  const { text, ring, Icon } = TONES[tone]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
        text,
        ring,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
