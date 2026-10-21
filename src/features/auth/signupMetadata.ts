import { parseLevel } from '../../lib/parseLevel'

export interface SignupProfile {
  name: string
  phone: string
  playtomicLevel: string
  gender: string
  isLeftHanded: boolean
  country: string
  birthday: string
  preferredPosition: string
  taglineLabel: string
  notes: string
}

// C-2: exactly these keys, all strings. No email and no avatar_url.
export function buildSignupMetadata({ profile }: { profile: SignupProfile }) {
  return {
    name: profile.name.trim(),
    phone: profile.phone.trim(),
    playtomic_level: String(parseLevel(profile.playtomicLevel) ?? 0),
    playtomic_username: '',
    gender: profile.gender,
    is_left_handed: String(profile.isLeftHanded),
    country: profile.country,
    birthday: profile.birthday,
    preferred_position: profile.preferredPosition,
    tagline_label: profile.taglineLabel,
    notes: profile.notes,
  }
}
