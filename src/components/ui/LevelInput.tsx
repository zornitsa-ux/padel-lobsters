import { useId, type ReactNode } from 'react'
import { FormError } from './FormError'
import { useFieldError } from './useFieldError'
import { Well } from './Well'

interface LevelInputProps {
  value: string | number
  onChange: (value: string) => void
  label: string
  /** Help under the field: where to find the level, what it's used for. */
  hint?: ReactNode
  /** From `levelProblem` or `typedLevelProblem` (src/lib/level.ts). */
  error?: string
  /** Checked as the user types: the error is announced politely. */
  live?: boolean
  /** In a Well, on its own in a profile form; bare inside another form's flow. */
  inset?: boolean
  required?: boolean
  placeholder?: string
}

/**
 * A Playtomic level: text with a decimal keypad, not type="number", so "2,45"
 * can be typed. The rule lives in src/lib/level.ts.
 */
export function LevelInput({
  value,
  onChange,
  label,
  hint,
  error,
  live = false,
  inset = false,
  required = false,
  placeholder = 'e.g. 2.5',
}: LevelInputProps) {
  const inputId = useId()
  const hintId = useId()
  const { errorId, fieldProps } = useFieldError({
    message: error,
    describedBy: hint ? hintId : undefined,
  })
  const field = (
    <div className="space-y-1">
      <label className="label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        className="input"
        placeholder={placeholder}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...fieldProps}
      />
      <FormError id={errorId} message={error} polite={live} />
      {hint && (
        <p id={hintId} className="caption">
          {hint}
        </p>
      )}
    </div>
  )
  return inset ? <Well>{field}</Well> : field
}
