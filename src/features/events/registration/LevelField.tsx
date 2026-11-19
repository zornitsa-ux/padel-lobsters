import { useId } from 'react'
import { FormError } from '../../../components/ui/FormError'
import { useFieldError } from '../../../components/ui/useFieldError'
import { givenLevelProblem } from '../../../lib/parseLevel'
import { noLevelHint } from './levelHelpers'

interface LevelFieldProps {
  value: string
  onChange: (value: string) => void
  /** Shown under the field until something invalid is typed. */
  hint: string
  label?: string
}

/** A required Playtomic level. Blank waits quietly with the hint; anything invalid shows why. */
export default function LevelField({
  value,
  onChange,
  hint,
  label = 'Playtomic level',
}: LevelFieldProps) {
  const error = givenLevelProblem({ value, blank: '' })
  const hintId = useId()
  const field = useFieldError({ message: error })

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-lob-muted">
        {label}
        <input
          inputMode="decimal"
          required
          className="input py-2 text-sm mt-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={error ? undefined : hintId}
          {...field.fieldProps}
        />
      </label>
      <FormError id={field.errorId} message={error} polite />
      {!error && (
        <p id={hintId} className="caption">
          {hint}
        </p>
      )}
    </div>
  )
}

/** For an admin registering someone who has no level (S6b): the field, with a hint naming them. */
export function NoLevelField({
  name,
  value,
  onChange,
}: {
  name: string
  value: string
  onChange: (value: string) => void
}) {
  return <LevelField value={value} onChange={onChange} hint={noLevelHint({ name })} />
}
