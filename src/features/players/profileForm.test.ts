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
    expect(profileProblem({ form: complete })).toBe('')
  })
  it('lists what is missing, including email only when the form has one', () => {
    const form = { ...complete, country: '', phone: '' }
    expect(profileProblem({ form })).toBe('Please complete: Country, Phone / WhatsApp')
    expect(profileProblem({ form, email: '' })).toBe(
      'Please complete: Country, Email, Phone / WhatsApp',
    )
  })
  it('checks the phone format and the level range', () => {
    expect(profileProblem({ form: { ...complete, phone: '0612345678' } })).toMatch(/^Phone must/)
    expect(profileProblem({ form: { ...complete, playtomicLevel: '9' } })).toMatch(/^Playtomic/)
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
