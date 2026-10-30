import { isE164 } from '../../lib/whatsapp'
import { isLevelInRange } from '../../lib/parseLevel'

// The profile every member fills in: self-signup and a captain-created
// account finishing setup (D-021) use the same fields and rules.
export interface ProfileFieldValues {
  firstName: string
  lastName: string
  country: string
  gender: string
  isLeftHanded: boolean
  preferredPosition: string
  playtomicLevel: string
  phone: string
  birthday: string
}

// `email` is checked only when the form has an email field (self-signup).
export function profileProblem({
  form,
  email,
}: {
  form: ProfileFieldValues
  email?: string
}): string {
  const missing = []
  if (!form.firstName.trim()) missing.push('First Name')
  if (!form.lastName.trim()) missing.push('Last Name')
  if (!form.country) missing.push('Country')
  if (!form.gender) missing.push('Gender')
  if (email !== undefined && !email.trim()) missing.push('Email')
  if (!form.phone.trim()) missing.push('Phone / WhatsApp')
  if (!form.playtomicLevel.trim()) missing.push('Playtomic Level')
  if (missing.length > 0) return `Please complete: ${missing.join(', ')}`
  // E.164 so we can build wa.me links for transfer offers.
  if (!isE164(form.phone)) {
    return 'Phone must start with + and the country code (e.g. +31612345678).'
  }
  if (!isLevelInRange({ value: form.playtomicLevel }))
    return 'Playtomic level must be a number from 0 to 7, e.g. 3.5.'
  return ''
}

export const fullName = ({ form }: { form: Pick<ProfileFieldValues, 'firstName' | 'lastName'> }) =>
  `${form.firstName.trim()} ${form.lastName.trim()}`.trim()

// A stored single-line name back into the two fields: the last word is the
// last name.
export const splitName = ({ name }: { name: string }) => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return { firstName: parts[0] ?? '', lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1)! }
}

// What the captain (or anyone before) stored, as a starting point for the form.
// A level of 0 means "not given", so the field starts empty.
export const formFromPlayer = ({
  player,
}: {
  player: {
    name: string
    country: string
    gender: string
    isLeftHanded: boolean
    preferredPosition: string
    playtomicLevel: number
    phone?: string | null
    birthday?: string | null
  }
}): ProfileFieldValues => ({
  ...splitName({ name: player.name }),
  country: player.country,
  gender: player.gender,
  isLeftHanded: player.isLeftHanded,
  preferredPosition: player.preferredPosition,
  playtomicLevel: player.playtomicLevel > 0 ? String(player.playtomicLevel) : '',
  phone: player.phone ?? '',
  birthday: player.birthday ?? '',
})

export const playerInputFromForm = ({ form }: { form: ProfileFieldValues }) => ({
  name: fullName({ form }),
  country: form.country,
  gender: form.gender,
  isLeftHanded: form.isLeftHanded,
  preferredPosition: form.preferredPosition,
  playtomicLevel: form.playtomicLevel,
  phone: form.phone.trim(),
  birthday: form.birthday,
})
