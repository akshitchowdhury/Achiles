export const num = new Intl.NumberFormat('en-US')

export function compact(value: number): string {
  return value >= 10_000
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
    : num.format(value)
}

/**
 * Up to one decimal, with no trailing zero. The server stores BMI as a Go int,
 * so forcing "26.0" would advertise precision the value does not carry.
 */
const decimalFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

export function decimal(value: number): string {
  return decimalFormat.format(value)
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}
