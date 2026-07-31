import clsx from 'clsx'
import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

const CONTROL =
  'bg-raised border-hairline-strong text-ink placeholder:text-ink-muted h-11 w-full rounded-xl border px-3 text-sm transition-colors focus:border-volt/60'

interface FieldShellProps {
  label: string
  htmlFor: string
  error?: string
  suffix?: string
  children: ReactNode
}

export function FieldShell({ label, htmlFor, error, suffix, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-ink-dim mb-1.5 block text-xs font-medium">
        {label}
        {suffix && <span className="text-ink-muted ml-1 font-normal">({suffix})</span>}
      </label>
      {children}
      {/* role=alert so the message is announced when validation fails */}
      {error && (
        <p role="alert" className="text-critical mt-1.5 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  suffix?: string
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, suffix, id, className, ...rest }, ref) => {
    const fieldId = id ?? rest.name ?? label
    return (
      <FieldShell label={label} htmlFor={fieldId} error={error} suffix={suffix}>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={clsx(CONTROL, error && 'border-critical/70', className)}
          {...rest}
        />
      </FieldShell>
    )
  },
)
TextField.displayName = 'TextField'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: ReadonlyArray<{ value: string; label: string }>
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, options, id, className, ...rest }, ref) => {
    const fieldId = id ?? rest.name ?? label
    return (
      <FieldShell label={label} htmlFor={fieldId} error={error}>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          className={clsx(CONTROL, error && 'border-critical/70', className)}
          {...rest}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FieldShell>
    )
  },
)
SelectField.displayName = 'SelectField'
