import { describe, expect, it } from 'vitest'
import { formFromPlayer, fullName, profileProblem, splitName } from './profileForm'

const complete = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  country: 'NL',
  gender: 'female',
  isLeftHanded: false,
  preferredPosition: '',
  playtomicLevel: '3.5',
  phone: '+31612345678',
  birthday: '',
}

describe('profileProblem', () => {
  it('accepts a complete profile', () => {
    expect(profileProblem({ form: complete, levelPolicy: 'optional' })).toBe('')
  })
  it('lists what is missing, including email only when the form has one', () => {
    const form = { ...complete, country: '', phone: '' }
    expect(profileProblem({ form, levelPolicy: 'optional' })).toBe(
      'Please complete: Country, Phone / WhatsApp',
    )
    expect(profileProblem({ form, email: '', levelPolicy: 'optional' })).toBe(
      'Please complete: Country, Email, Phone / WhatsApp',
    )
  })
  it('accepts a profile without a Playtomic level where the level is optional', () => {
    const form = { ...complete, playtomicLevel: '  ' }
    expect(profileProblem({ form, levelPolicy: 'optional' })).toBe('')
  })
  it('keeps a recorded level: blank is refused', () => {
    const form = { ...complete, playtomicLevel: '' }
    expect(profileProblem({ form, levelPolicy: 'keep' })).toMatch(/can be changed, but not removed/)
  })
  it('checks the phone format and the level range', () => {
    expect(
      profileProblem({ form: { ...complete, phone: '0612345678' }, levelPolicy: 'optional' }),
    ).toMatch(/^Phone must/)
    expect(
      profileProblem({ form: { ...complete, playtomicLevel: '9' }, levelPolicy: 'optional' }),
    ).toMatch(/^Playtomic/)
  })
})

describe('names', () => {
  it('splits on the last word and joins back', () => {
    expect(splitName({ name: ' Ana  de la Cruz ' })).toEqual({
      firstName: 'Ana de la',
      lastName: 'Cruz',
    })
    expect(splitName({ name: 'Gus' })).toEqual({ firstName: 'Gus', lastName: '' })
    expect(fullName({ form: { firstName: ' Ana ', lastName: 'Cruz ' } })).toBe('Ana Cruz')
  })
})

describe('formFromPlayer', () => {
  it('prefills from the stored profile and leaves an unknown level empty', () => {
    const form = formFromPlayer({
      player: {
        name: 'Test Player',
        country: '',
        gender: '',
        isLeftHanded: false,
        preferredPosition: '',
        playtomicLevel: 0,
        phone: null,
        birthday: null,
      },
    })
    expect(form).toMatchObject({ firstName: 'Test', lastName: 'Player', playtomicLevel: '' })
  })
})
