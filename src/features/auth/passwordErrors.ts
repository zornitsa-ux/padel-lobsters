import { describeRateLimit, GENERIC_AUTH_ERROR, type AuthErrorLike } from './authErrors'

export const PASSWORD_RULES_COPY =
  'At least 10 characters, with a lowercase letter, an uppercase letter and a digit. It must not appear in a known data breach.'

const REASON_MESSAGES: Record<string, string> = {
  length: 'Your password needs at least 10 characters.',
  characters: 'Add a lowercase letter, an uppercase letter and a digit.',
  pwned: 'That password has appeared in a known data breach. Choose a different one.',
}

const CODE_MESSAGES: Record<string, string> = {
  current_password_required: 'Enter your current password.',
  current_password_invalid: "That current password isn't right.",
  same_password: 'Your new password must be different from the current one.',
  reauthentication_needed: "For your security, enter the code we emailed you to confirm it's you.",
  reauthentication_not_valid: 'That code is wrong or has expired. Request a new one.',
}

function describeWeakPassword({ reasons }: { reasons: readonly string[] | undefined }): string {
  const known = (reasons ?? []).map((reason) => REASON_MESSAGES[reason]).filter(Boolean)
  return known.length > 0 ? known.join(' ') : PASSWORD_RULES_COPY
}

export function describePasswordError({ error }: { error: AuthErrorLike }): string {
  if (error.code === 'weak_password') return describeWeakPassword({ reasons: error.reasons })
  const known = error.code ? CODE_MESSAGES[error.code] : undefined
  return known ?? describeRateLimit({ error }) ?? GENERIC_AUTH_ERROR
}
