import { describe, expect, it } from 'vitest'
import {
  describeRateLimit,
  describeSignInError,
  rateLimitWaitSeconds,
  UNKNOWN_EMAIL_MESSAGE,
} from './authErrors'

const rateLimit = {
  status: 429,
  code: 'over_email_send_rate_limit',
  message: 'For security purposes, you can only request this after 37 seconds.',
}

describe('rate limits', () => {
  it('parses the wait out of the GoTrue message', () => {
    expect(rateLimitWaitSeconds({ error: rateLimit })).toBe(37)
    expect(rateLimitWaitSeconds({ error: { message: 'nope' } })).toBeNull()
  })

  it('turns a 429 into a wait message', () => {
    expect(describeRateLimit({ error: rateLimit })).toBe(
      'Please wait 37 seconds before asking for another code.',
    )
  })

  it('has a fallback when the wait is not in the message', () => {
    expect(describeRateLimit({ error: { status: 429, message: 'rate limit' } })).toMatch(
      /too many attempts/i,
    )
  })

  it('is null for other errors', () => {
    expect(describeRateLimit({ error: { status: 400, message: 'x' } })).toBeNull()
  })
})

describe('describeSignInError', () => {
  it('names an unknown email on the request step', () => {
    expect(
      describeSignInError({ error: { status: 422, code: 'otp_disabled' }, step: 'request' }),
    ).toBe(UNKNOWN_EMAIL_MESSAGE)
  })

  it('explains a wrong or expired code on the verify step', () => {
    expect(
      describeSignInError({ error: { status: 403, code: 'otp_expired' }, step: 'verify' }),
    ).toMatch(/code didn't work/i)
  })

  it('explains bad credentials on the password step', () => {
    expect(
      describeSignInError({
        error: { status: 400, code: 'invalid_credentials' },
        step: 'password',
      }),
    ).toMatch(/don't match/i)
  })

  it('shows the wait on any step', () => {
    expect(describeSignInError({ error: rateLimit, step: 'reset' })).toMatch(/37 seconds/)
  })

  it('falls back to generic copy', () => {
    expect(describeSignInError({ error: { status: 500 }, step: 'request' })).toMatch(
      /something went wrong/i,
    )
  })
})
