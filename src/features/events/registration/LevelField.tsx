import { LevelInput } from '../../../components/ui/LevelInput'
import { typedLevelProblem } from '../../../lib/level'
import { noLevelHint } from './levelHelpers'

interface LevelFieldProps {
  value: string
  onChange: (value: string) => void
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
  return (
    <LevelInput
      label={label}
      value={value}
      onChange={onChange}
      hint={hint}
      error={typedLevelProblem({ value, policy: 'required' })}
      live
      required
    />
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
