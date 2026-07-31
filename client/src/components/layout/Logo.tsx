import clsx from 'clsx'

/**
 * A shield/chevron mark — stacked ascending bars inside a shield outline,
 * reading as both "progress" and "armour".
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={clsx('size-6', className)}
      role="img"
      aria-label="Achiles"
      fill="none"
    >
      <path
        d="M12 2.5 20.5 6v6.2c0 4.6-3.4 8-8.5 9.3-5.1-1.3-8.5-4.7-8.5-9.3V6L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 15.4v-2.6M12 15.4v-5M15.4 15.4v-3.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <Logo className="text-volt" />
      <span className="text-ink text-base font-semibold tracking-tight">
        Achiles
      </span>
    </div>
  )
}
