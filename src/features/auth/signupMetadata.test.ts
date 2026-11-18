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

  it('adds the signup source only when chosen (C-5)', () => {
    expect(buildSignupMetadata({ profile })).not.toHaveProperty('signup_source')
    expect(
      buildSignupMetadata({ profile, source: { source: 'lobster', detail: '  A Friend ' } }),
    ).toMatchObject({ signup_source: 'lobster', signup_source_detail: 'A Friend' })
  })

  it('drops the detail for instagram and plaza_whatsapp, and when blank', () => {
    const insta = buildSignupMetadata({ profile, source: { source: 'instagram', detail: 'x' } })
    expect(insta.signup_source).toBe('instagram')
    expect(insta).not.toHaveProperty('signup_source_detail')
    expect(
      buildSignupMetadata({ profile, source: { source: 'other', detail: '  ' } }),
    ).not.toHaveProperty('signup_source_detail')
  })

  it('sends an empty level as 0', () => {
    expect(
      buildSignupMetadata({ profile: { ...profile, playtomicLevel: '' } }).playtomic_level,
    ).toBe('0')
  })
})
