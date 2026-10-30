import type { Dispatch, SetStateAction } from 'react'
import CountryPicker from '../../components/ui/CountryPicker'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { FormError } from '../../components/ui/FormError'
import { useFieldError } from '../../components/ui/useFieldError'
import type { ProfileFieldValues } from './profileForm'

type FieldsProps<T> = {
  form: T
  setForm: Dispatch<SetStateAction<T>>
}

export function ProfileNameFields<T extends ProfileFieldValues>({
  form,
  setForm,
  nameError,
}: FieldsProps<T> & { nameError?: string }) {
  const { errorId, fieldProps } = useFieldError({ message: nameError })
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">First Name</label>
          <input
            required
            className="input"
            placeholder="e.g. Augustin"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            {...fieldProps}
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
            {...fieldProps}
          />
        </div>
      </div>
      <FormError id={errorId} message={nameError} />
    </div>
  )
}

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
]

const HANDS = [
  { value: false, label: 'Right' },
  { value: true, label: '🤚 Left' },
]

const SIDES = [
  { value: 'left', label: '👈 Left' },
  { value: 'right', label: '👉 Right' },
  { value: 'both', label: '↔️ Both' },
]

type ChoiceValues = Pick<ProfileFieldValues, 'gender' | 'isLeftHanded' | 'preferredPosition'>

// Gender, hand and side, shared by signup, settings and the admin player form.
// Tapping the chosen gender or side again clears it.
export function ProfileChoiceFields<T extends ChoiceValues>({
  form,
  setForm,
}: {
  form: T
  setForm: (update: (form: T) => T) => void
}) {
  return (
    <>
      <div>
        <label className="label">Gender</label>
        <p className="text-xs text-lob-muted-light mb-2">For optimal pair matching</p>
        <SegmentedControl
          ariaLabel="Gender"
          options={GENDERS}
          value={form.gender}
          onChange={(val) => setForm((f) => ({ ...f, gender: f.gender === val ? '' : val }))}
        />
      </div>

      <div>
        <label className="label">Playing hand</label>
        <SegmentedControl
          ariaLabel="Playing hand"
          options={HANDS}
          value={form.isLeftHanded}
          onChange={(val) => setForm((f) => ({ ...f, isLeftHanded: val }))}
        />
      </div>

      <div>
        <label className="label">Preferred side</label>
        <SegmentedControl
          ariaLabel="Preferred side"
          options={SIDES}
          value={form.preferredPosition}
          onChange={(val) =>
            setForm((f) => ({
              ...f,
              preferredPosition: f.preferredPosition === val ? '' : val,
            }))
          }
        />
      </div>
    </>
  )
}

// Country, gender, hand, side and Playtomic level.
export function ProfilePlayFields<T extends ProfileFieldValues>({
  form,
  setForm,
  levelError,
}: FieldsProps<T> & { levelError?: string }) {
  const { errorId, fieldProps } = useFieldError({ message: levelError })
  return (
    <>
      <div>
        <label className="label">Country</label>
        <CountryPicker
          value={form.country}
          onChange={(val) => setForm((f) => ({ ...f, country: val }))}
        />
      </div>

      <ProfileChoiceFields form={form} setForm={setForm} />

      <div className="bg-blue-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Playtomic Level</p>
        <div>
          <label className="label">Playtomic Level (0–7)</label>
          <div className="space-y-1">
            <input
              type="text"
              inputMode="decimal"
              className="input"
              placeholder="e.g. 3.5"
              value={form.playtomicLevel}
              onChange={(e) => setForm((f) => ({ ...f, playtomicLevel: e.target.value }))}
              {...fieldProps}
            />
            <FormError id={errorId} message={levelError} />
            <p className="text-xs text-lob-muted">
              Check your Playtomic app — it shows your current level. We use it to build balanced
              matches, and it improves as you play.
            </p>
          </div>
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
