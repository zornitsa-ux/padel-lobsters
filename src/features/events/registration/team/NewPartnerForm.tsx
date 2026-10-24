import type { ReactNode } from 'react'
import { PARTNER_CONSENT_LABEL, isLevelValid, type NewPartnerDraft } from './teamHelpers'

interface NewPartnerFormProps {
  draft: NewPartnerDraft
  onChange: (draft: NewPartnerDraft) => void
  emailError?: ReactNode
}

export default function NewPartnerForm({ draft, onChange, emailError }: NewPartnerFormProps) {
  const set = (patch: Partial<NewPartnerDraft>) => onChange({ ...draft, ...patch })

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
      <label className="block text-xs font-semibold text-lob-muted">
        Email
        <input
          type="email"
          required
          className="input py-2 text-sm mt-1"
          value={draft.email}
          onChange={(e) => set({ email: e.target.value })}
          autoComplete="off"
        />
        {emailError}
      </label>
      <label className="block text-xs font-semibold text-lob-muted">
        Playtomic level (optional)
        <input
          inputMode="decimal"
          className="input py-2 text-sm mt-1"
          value={draft.level}
          onChange={(e) => set({ level: e.target.value })}
        />
        {!isLevelValid({ level: draft.level }) && (
          <span className="block mt-1 text-red-600">Enter a level between 0 and 7.</span>
        )}
      </label>
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
