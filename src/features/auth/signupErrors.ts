import { describeRateLimit, type AuthErrorLike } from './authErrors'

export const SIGNUP_HOOK_MESSAGES = {
  nameRequired: 'Please enter your name.',
  nameTooLong: 'Your name can be at most 100 characters.',
  levelInvalid: 'Enter your Playtomic level as a number, like 2.5.',
  placeholder: 'You’ve already been added to a Lobster team — ask an admin to invite you.',
} as const

export type SignupField = 'name' | 'level'

export interface SignupErrorView {
  field: SignupField | null
  message: string
}

const FIELD_BY_MESSAGE: Record<string, SignupField> = {
  [SIGNUP_HOOK_MESSAGES.nameRequired]: 'name',
  [SIGNUP_HOOK_MESSAGES.nameTooLong]: 'name',
  [SIGNUP_HOOK_MESSAGES.levelInvalid]: 'level',
  [SIGNUP_HOOK_MESSAGES.placeholder]: 'name',
}

export const GENERIC_SIGNUP_ERROR = 'Could not create your profile — please try again.'

export function describeSignupError({ error }: { error: AuthErrorLike }): SignupErrorView {
  const field = error.status === 400 ? FIELD_BY_MESSAGE[error.message ?? ''] : undefined
  if (field) return { field, message: error.message as string }
  return { field: null, message: describeRateLimit({ error }) ?? GENERIC_SIGNUP_ERROR }
}
