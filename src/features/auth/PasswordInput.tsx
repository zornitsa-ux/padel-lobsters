import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'

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
      <IconButton
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        variant="ghost"
        size="sm"
        className="absolute right-1 top-1/2 -translate-y-1/2"
      >
        <Icon aria-hidden="true" />
      </IconButton>
    </div>
  )
}
