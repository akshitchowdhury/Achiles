import clsx from 'clsx'
import { Check } from 'lucide-react'

export interface Option<T extends string> {
  value: T
  label: string
  detail?: string
}

interface OptionGroupProps<T extends string> {
  legend: string
  options: ReadonlyArray<Option<T>>
  value: T
  onChange: (value: T) => void
  columns?: 1 | 2 | 3
}

/**
 * A radio group drawn as cards. Selection is carried by the border, the tick
 * and aria-checked — never by colour on its own.
 */
export function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 1,
}: OptionGroupProps<T>) {
  return (
    <fieldset>
      <legend className="text-ink-dim mb-2.5 text-xs font-medium">{legend}</legend>
      <div
        role="radiogroup"
        aria-label={legend}
        className={clsx(
          'grid gap-2',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-3',
        )}
      >
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              // The visible text lives in nested spans, so name the control
              // explicitly rather than relying on content traversal.
              aria-label={option.detail ? `${option.label} — ${option.detail}` : option.label}
              onClick={() => onChange(option.value)}
              className={clsx(
                'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors',
                selected
                  ? 'border-volt/60 bg-volt/5'
                  : 'border-hairline-strong bg-raised hover:border-hairline-strong/80 hover:bg-raised/70',
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
                  selected ? 'border-volt bg-volt' : 'border-ink-muted',
                )}
              >
                {selected && <Check className="text-plane size-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="text-ink block text-sm font-medium">{option.label}</span>
                {option.detail && (
                  <span className="text-ink-muted mt-0.5 block text-xs">{option.detail}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
