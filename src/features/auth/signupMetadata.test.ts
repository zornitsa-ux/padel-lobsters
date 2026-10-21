import { describe, expect, it } from 'vitest'
import { buildSignupMetadata, type SignupProfile } from './signupMetadata'

const profile: SignupProfile = {
  name: '  Ada Lovelace ',
  phone: ' +31612345678 ',
  playtomicLevel: '2,5',
  gender: 'female',
  isLeftHanded: true,
  country: 'Netherlands',
  birthday: '',
  preferredPosition: 'left',
  taglineLabel: '🎤 Trash Talk',
  notes: 'hi',
}

describe('buildSignupMetadata', () => {
  it('sends exactly the C-2 keys, all strings', () => {
    const data = buildSignupMetadata({ profile })

    expect(Object.keys(data).sort()).toEqual([
      'birthday',
      'country',
      'gender',
      'is_left_handed',
      'name',
      'notes',
      'phone',
      'playtomic_level',
      'playtomic_username',
      'preferred_position',
      'tagline_label',
    ])
    expect(Object.values(data).every((value) => typeof value === 'string')).toBe(true)
  })

  it('normalises name, phone, level and the hand flag', () => {
    expect(buildSignupMetadata({ profile })).toMatchObject({
      name: 'Ada Lovelace',
      phone: '+31612345678',
      playtomic_level: '2.5',
      is_left_handed: 'true',
      birthday: '',
    })
  })
})
