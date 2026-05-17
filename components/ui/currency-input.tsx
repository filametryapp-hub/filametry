'use client'

import { useT } from '@/lib/i18n'

interface CurrencyInputProps {
  value: number
  onChange: (v: number) => void
  className?: string
  id?: string
}

export function CurrencyInput({ value, onChange, className, id }: CurrencyInputProps) {
  const { fmtCurrency } = useT()

  const cents = Math.round(value * 100)

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault()
      const newCents = Math.min(cents * 10 + parseInt(e.key), 99999999)
      onChange(newCents / 100)
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      onChange(Math.floor(cents / 10) / 100)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      onChange(0)
    }
    // Allow Tab, arrow keys, etc.
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      value={fmtCurrency(value)}
      onKeyDown={handleKeyDown}
      onChange={() => {}}
      className={className}
      onFocus={e => e.target.select()}
    />
  )
}
