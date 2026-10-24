import type { Dispatch, SetStateAction } from 'react'
import CountryPicker from '../../components/ui/CountryPicker'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { ProfileFieldValues } from './profileForm'

type FieldsProps<T extends ProfileFieldValues> = {
  form: T
  setForm: Dispatch<SetStateAction<T>>
}

export function ProfileNameFields<T extends ProfileFieldValues>({ form, setForm }: FieldsProps<T>) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="label">First Name</label>
        <input
          required
          className="input"
          placeholder="e.g. Augustin"
          value={form.firstName}
          onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
        />
      </div>
      <div>
        <label className="label">Last Name</label>
        <input
          required
          className="input"
          placeholder="e.g. Tapia"
          value={form.lastName}
          onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
        />
      </div>
    </div>
  )
}

const SIDES = [
  ['left', '👈 Left'],
  ['right', '👉 Right'],
  ['both', '↔️ Both'],
] as const

// Country, gender, hand, side and Playtomic level.
export function ProfilePlayFields<T extends ProfileFieldValues>({
  form,
  setForm,
  levelError,
}: FieldsProps<T> & { levelError?: string }) {
  return (
    <>
      <div>
        <label className="label">Country</label>
        <CountryPicker
          value={form.country}
          onChange={(val) => setForm((f) => ({ ...f, country: val }))}
        />
      </div>

      <div>
        <label className="label">Gender</label>
        <p className="text-xs text-lob-muted-light mb-2">For optimal pair matching</p>
        <SegmentedControl
          ariaLabel="Gender"
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
          value={form.gender}
          onChange={(val) => setForm((f) => ({ ...f, gender: f.gender === val ? '' : val }))}
        />
      </div>

      <div>
        <label className="label">Playing hand</label>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
            form.isLeftHanded
              ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
              : 'bg-gray-100 text-lob-muted'
          }`}
        >
          🤚 {form.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
        </button>
      </div>

      <div>
        <label className="label">Preferred Side</label>
        <div className="flex gap-2">
          {SIDES.map(([val, lbl]) => (
            <button
              type="button"
              key={val}
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  preferredPosition: f.preferredPosition === val ? '' : val,
                }))
              }
              className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                form.preferredPosition === val
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-lob-slate'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Playtomic Level</p>
        <div>
          <label className="label">Playtomic Level (0–7)</label>
          <input
            type="text"
            inputMode="decimal"
            className="input"
            placeholder="e.g. 3.5"
            value={form.playtomicLevel}
            onChange={(e) => setForm((f) => ({ ...f, playtomicLevel: e.target.value }))}
          />
          {levelError && (
            <p
              role="alert"
              className="text-xs text-lob-danger bg-lob-danger-light rounded-lg p-2 mt-1"
            >
              {levelError}
            </p>
          )}
          <p className="text-xs text-lob-muted mt-1">
            Check your Playtomic app — it shows your current level. We use it to build balanced
            matches, and it improves as you play.
          </p>
        </div>
      </div>
    </>
  )
}

export function ProfileContactFields<T extends ProfileFieldValues>({
  form,
  setForm,
}: FieldsProps<T>) {
  return (
    <>
      <div>
        <label className="label">Phone / WhatsApp</label>
        <input
          type="tel"
          className="input"
          placeholder="+31612345678"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <p className="text-xs text-lob-muted-light mt-1">
          Start with + and your country code, e.g. +31 for the Netherlands. Visible to organizers
          only.
        </p>
      </div>

      <div>
        <label className="label">Birthday 🎂</label>
        <input
          type="date"
          className="input"
          value={form.birthday || ''}
          onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
        />
      </div>
    </>
  )
}
