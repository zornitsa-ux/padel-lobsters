import { describe, expect, it } from 'vitest'
import { describeSignupError, GENERIC_SIGNUP_ERROR, SIGNUP_HOOK_MESSAGES } from './signupErrors'

const hookError = (message: string) => ({ status: 400, code: 'unknown', message })

describe('SIGNUP_HOOK_MESSAGES', () => {
  it('matches the C-3 strings exactly', () => {
    expect(SIGNUP_HOOK_MESSAGES).toEqual({
      nameRequired: 'Please enter your name.',
      nameTooLong: 'Your name can be at most 100 characters.',
      levelInvalid: 'Enter your Playtomic level as a number, like 2.5.',
      placeholder: 'You’ve already been added to a Lobster team — ask an admin to invite you.',
    })
  })
})

describe('describeSignupError', () => {
  it.each([
    [SIGNUP_HOOK_MESSAGES.nameRequired, 'name'],
    [SIGNUP_HOOK_MESSAGES.nameTooLong, 'name'],
    [SIGNUP_HOOK_MESSAGES.levelInvalid, 'level'],
    [SIGNUP_HOOK_MESSAGES.placeholder, 'name'],
  ])('puts "%s" next to the %s field', (message, field) => {
    expect(describeSignupError({ error: hookError(message) })).toEqual({ field, message })
  })

  it('ignores a hook message that is not a 400', () => {
    const error = { status: 500, message: SIGNUP_HOOK_MESSAGES.nameRequired }
    expect(describeSignupError({ error })).toEqual({ field: null, message: GENERIC_SIGNUP_ERROR })
  })

  it('shows the wait for a 429', () => {
    const view = describeSignupError({
      error: { status: 429, message: 'you can only request this after 30 seconds.' },
    })
    expect(view.field).toBeNull()
    expect(view.message).toMatch(/30 seconds/)
  })

  it('uses generic copy for everything else', () => {
    expect(describeSignupError({ error: hookError('something else') }).message).toBe(
      GENERIC_SIGNUP_ERROR,
    )
  })
})
