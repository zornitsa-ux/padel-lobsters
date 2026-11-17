import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormError } from '../../components/ui/FormError'
import { useFieldError } from '../../components/ui/useFieldError'
import {
  SIGNUP_SOURCE_DETAIL_MAX,
  SIGNUP_SOURCES,
  type SignupSourceAnswer,
  type SignupSourceCode,
} from './signupSource'

const DETAIL_PLACEHOLDER: Partial<Record<SignupSourceCode, string>> = {
  lobster: 'Their name',
  other: 'Where did you hear about us?',
}

// One optional tap; tapping the chosen answer again clears it. The detail box
// shows for lobster and other, the codes that take a detail (C-5).
export function SignupSourceField({
  value,
  onChange,
  error,
}: {
  value: SignupSourceAnswer
  onChange: (value: SignupSourceAnswer) => void
  error?: string
}) {
  const { errorId, fieldProps } = useFieldError({ message: error })
  const detailPlaceholder = value.source ? DETAIL_PLACEHOLDER[value.source] : undefined
  return (
    <div className="space-y-2">
      <div>
        <label className="label">How did you find us?</label>
        <p className="caption">Optional</p>
      </div>
      <SegmentedControl
        layout="wrap"
        ariaLabel="How did you find us?"
        options={[...SIGNUP_SOURCES]}
        value={value.source}
        onChange={(source) => onChange({ ...value, source: value.source === source ? '' : source })}
      />
      {detailPlaceholder && (
        <input
          className="input"
          aria-label={detailPlaceholder}
          placeholder={detailPlaceholder}
          maxLength={SIGNUP_SOURCE_DETAIL_MAX}
          value={value.detail}
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
          {...fieldProps}
        />
      )}
      <FormError id={errorId} message={error} />
    </div>
  )
}
