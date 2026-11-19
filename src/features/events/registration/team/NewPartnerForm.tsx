import type { ReactNode } from 'react'
import { FormError } from '../../../../components/ui/FormError'
import { useFieldError } from '../../../../components/ui/useFieldError'
import LevelField from '../LevelField'
import { PARTNER_CONSENT_LABEL, type NewPartnerDraft } from './teamHelpers'

interface NewPartnerFormProps {
  draft: NewPartnerDraft
  onChange: (draft: NewPartnerDraft) => void
  emailError?: string
  /** Follows the email error inline, e.g. "Search members". */
  emailErrorAction?: ReactNode
}

export default function NewPartnerForm({
  draft,
  onChange,
  emailError,
  emailErrorAction,
}: NewPartnerFormProps) {
  const set = (patch: Partial<NewPartnerDraft>) => onChange({ ...draft, ...patch })
  const email = useFieldError({ message: emailError })

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
      <LevelField
        value={draft.level}
        onChange={(level) => set({ level })}
        hint="Not on Playtomic? Your best guess, e.g. 2.0. They can change it later."
      />
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
