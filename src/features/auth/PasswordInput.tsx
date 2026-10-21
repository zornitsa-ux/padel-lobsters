import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export interface PasswordInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'current-password' | 'new-password'
  'aria-describedby'?: string
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  'aria-describedby': describedBy,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
        className="input pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-lob-muted-light"
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
