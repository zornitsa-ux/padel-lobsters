import { describe, expect, it } from 'vitest'
import { describePasswordError, PASSWORD_RULES_COPY } from './passwordErrors'

const weak = (reasons?: string[]) => ({ status: 422, code: 'weak_password', reasons })

describe('describePasswordError', () => {
  it('states the rules up front', () => {
    expect(PASSWORD_RULES_COPY).toMatch(/10 characters/)
    expect(PASSWORD_RULES_COPY).toMatch(/lowercase/)
    expect(PASSWORD_RULES_COPY).toMatch(/uppercase/)
    expect(PASSWORD_RULES_COPY).toMatch(/digit/)
    expect(PASSWORD_RULES_COPY).toMatch(/breach/)
  })

  it.each([
    ['length', /at least 10 characters/i],
    ['characters', /lowercase letter, an uppercase letter and a digit/i],
    ['pwned', /known data breach/i],
  ])('maps the %s reason', (reason, message) => {
    expect(describePasswordError({ error: weak([reason]) })).toMatch(message)
  })

  it('joins several reasons', () => {
    const message = describePasswordError({ error: weak(['length', 'pwned']) })
    expect(message).toMatch(/10 characters/)
    expect(message).toMatch(/breach/)
  })

  it('falls back to the rules when no reason is known', () => {
    expect(describePasswordError({ error: weak() })).toBe(PASSWORD_RULES_COPY)
    expect(describePasswordError({ error: weak(['mystery']) })).toBe(PASSWORD_RULES_COPY)
  })

  it.each([
    ['current_password_required', /enter your current password/i],
    ['current_password_invalid', /current password isn't right/i],
    ['same_password', /different/i],
    ['reauthentication_needed', /code we emailed/i],
    ['reauthentication_not_valid', /wrong or has expired/i],
  ])('maps %s', (code, message) => {
    expect(describePasswordError({ error: { status: 400, code } })).toMatch(message)
  })

  it('shows the wait for an email rate limit', () => {
    expect(
      describePasswordError({
        error: { status: 429, message: 'you can only request this after 12 seconds.' },
      }),
    ).toMatch(/12 seconds/)
  })

  it('falls back to generic copy', () => {
    expect(describePasswordError({ error: { status: 500 } })).toMatch(/something went wrong/i)
  })
})
