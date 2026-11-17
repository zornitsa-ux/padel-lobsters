import { parseLevel } from '../../lib/parseLevel'
import { NO_SIGNUP_SOURCE, signupSourceMetadata, type SignupSourceAnswer } from './signupSource'

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

// Pin-auth C-2: exactly these keys, all strings, plus signup-revamp C-5's
// two optional keys. No email and no avatar_url.
export function buildSignupMetadata({
  profile,
  source = NO_SIGNUP_SOURCE,
}: {
  profile: SignupProfile
  source?: SignupSourceAnswer
}) {
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
    ...signupSourceMetadata({ answer: source }),
  }
}
