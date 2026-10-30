import type { ReactNode } from 'react'
import { FormError } from '../../../../components/ui/FormError'
import { useFieldError } from '../../../../components/ui/useFieldError'
import { PARTNER_CONSENT_LABEL, isLevelValid, type NewPartnerDraft } from './teamHelpers'

interface NewPartnerFormProps {
  draft: NewPartnerDraft
  onChange: (draft: NewPartnerDraft) => void
  emailError?: string
  /** Follows the email error inline, e.g. "Search members". */
  emailErrorAction?: ReactNode
}

const LEVEL_ERROR = 'Enter a level between 0 and 7.'

export default function NewPartnerForm({
  draft,
  onChange,
  emailError,
  emailErrorAction,
}: NewPartnerFormProps) {
  const set = (patch: Partial<NewPartnerDraft>) => onChange({ ...draft, ...patch })
  const levelError = isLevelValid({ level: draft.level }) ? '' : LEVEL_ERROR
  const email = useFieldError({ message: emailError })
  const level = useFieldError({ message: levelError })

  return (
    <div className="space-y-3">
      <p className="text-sm text-lob-slate">
        You&apos;re creating a Padel Lobsters account for your partner. They&apos;ll sign in with
        this email.
      </p>
      <label className="block text-xs font-semibold text-lob-muted">
        Name
        <input
          className="input py-2 text-sm mt-1"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          autoComplete="off"
        />
      </label>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-lob-muted">
          Email
          <input
            type="email"
            required
            className="input py-2 text-sm mt-1"
            value={draft.email}
            onChange={(e) => set({ email: e.target.value })}
            autoComplete="off"
            {...email.fieldProps}
          />
        </label>
        <FormError id={email.errorId} message={emailError} action={emailErrorAction} />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-lob-muted">
          Playtomic level (optional)
          <input
            inputMode="decimal"
            className="input py-2 text-sm mt-1"
            value={draft.level}
            onChange={(e) => set({ level: e.target.value })}
            {...level.fieldProps}
          />
        </label>
        <FormError id={level.errorId} message={levelError} polite />
      </div>
      <label className="flex items-start gap-2 text-xs text-lob-slate">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={draft.consent}
          onChange={(e) => set({ consent: e.target.checked })}
        />
        <span>{PARTNER_CONSENT_LABEL}</span>
      </label>
    </div>
  )
}
