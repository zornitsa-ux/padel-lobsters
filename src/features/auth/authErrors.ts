export interface AuthErrorLike {
  status?: number
  code?: string
  message?: string
  reasons?: readonly string[]
}

export const GENERIC_AUTH_ERROR = 'Something went wrong. Try again in a moment.'

const WAIT_PATTERN = /after (\d+) seconds?/i

export function rateLimitWaitSeconds({ error }: { error: AuthErrorLike }): number | null {
  const match = WAIT_PATTERN.exec(error.message ?? '')
  return match ? Number(match[1]) : null
}

export function isRateLimited({ error }: { error: AuthErrorLike }): boolean {
  return error.status === 429 || error.code === 'over_email_send_rate_limit'
}

export function waitMessage({ seconds }: { seconds: number }): string {
  return `Please wait ${seconds} ${seconds === 1 ? 'second' : 'seconds'} before asking for another code.`
}

export function describeRateLimit({ error }: { error: AuthErrorLike }): string | null {
  if (!isRateLimited({ error })) return null
  const seconds = rateLimitWaitSeconds({ error })
  return seconds === null
    ? 'Too many attempts. Wait a few minutes and try again.'
    : waitMessage({ seconds })
}

export type SignInStep = 'request' | 'verify' | 'password' | 'reset'

export const UNKNOWN_EMAIL_MESSAGE =
  "We couldn't find that email. Check the address, or message an admin on WhatsApp if you're not sure which email you used."

const isUnknownEmail = ({ error }: { error: AuthErrorLike }) =>
  error.code === 'otp_disabled' ||
  error.status === 422 ||
  /signups? not allowed/i.test(error.message ?? '')

export function describeSignInError({
  error,
  step,
}: {
  error: AuthErrorLike
  step: SignInStep
}): string {
  const limited = describeRateLimit({ error })
  if (limited) return limited
  if (step === 'request' && isUnknownEmail({ error })) return UNKNOWN_EMAIL_MESSAGE
  if (step === 'verify') return "That code didn't work. It may have expired: ask for a new one."
  if (step === 'password' && error.code === 'invalid_credentials') {
    return "That email and password don't match. You can also email yourself a sign-in code."
  }
  if (step === 'password' && error.code === 'email_not_confirmed') {
    return 'Confirm your email first: email yourself a sign-in code instead.'
  }
  return GENERIC_AUTH_ERROR
}
