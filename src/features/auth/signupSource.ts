// "How did you find us" (signup revamp C-5). Codes match the hook and the
// player_signup_source CHECK.
export const SIGNUP_SOURCES = [
  { value: 'lobster', label: 'An existing Lobster' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'plaza_whatsapp', label: 'Plaza WhatsApp group' },
  { value: 'other', label: 'Other' },
] as const

export type SignupSourceCode = (typeof SIGNUP_SOURCES)[number]['value']

export const SIGNUP_SOURCE_DETAIL_MAX = 100

export interface SignupSourceAnswer {
  source: SignupSourceCode | ''
  detail: string
}

export const NO_SIGNUP_SOURCE: SignupSourceAnswer = { source: '', detail: '' }

const sourceTakesDetail = ({ source }: { source: SignupSourceAnswer['source'] }) =>
  source === 'lobster' || source === 'other'

// Both keys absent when skipped; the detail only with lobster/other.
export function signupSourceMetadata({ answer }: { answer: SignupSourceAnswer }): {
  signup_source?: SignupSourceCode
  signup_source_detail?: string
} {
  if (!answer.source) return {}
  const detail = answer.detail.trim()
  return {
    signup_source: answer.source,
    ...(sourceTakesDetail(answer) && detail ? { signup_source_detail: detail } : {}),
  }
}
