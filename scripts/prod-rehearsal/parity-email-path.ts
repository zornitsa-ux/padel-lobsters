import type { SupabaseClient } from '@supabase/supabase-js'
import type { Account } from './parity-accounts.ts'
import {
  deleteMessages,
  extractCredential,
  messageBody,
  messageIdsTo,
  waitForNewMessage,
} from './parity-mailpit.ts'
import { signOutLocal, verifyPaced } from './parity-signin.ts'

export interface EmailPathResult {
  passed: boolean
  failure?: string
}

const EMAIL_CODE_COUNT = 5
const RESEND_WINDOW_MS = 61_000
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const pickEmailPathAccounts = ({ accounts }: { accounts: Account[] }) =>
  accounts.slice(0, EMAIL_CODE_COUNT)

async function sendCode({ anon, email }: { anon: SupabaseClient; email: string }) {
  const options = { shouldCreateUser: false }
  const first = await anon.auth.signInWithOtp({ email, options })
  if (first.error?.code !== 'over_email_send_rate_limit') return first.error
  await sleep(RESEND_WINDOW_MS)
  return (await anon.auth.signInWithOtp({ email, options })).error
}

export async function checkEmailPath({
  anon,
  mailpitUrl,
  email,
  pace,
}: {
  anon: SupabaseClient
  mailpitUrl: string
  email: string
  pace: () => Promise<void>
}): Promise<EmailPathResult> {
  try {
    const knownIds = await messageIdsTo({ mailpitUrl, email })
    const sendError = await sendCode({ anon, email })
    if (sendError) return { passed: false, failure: `send:${sendError.code ?? sendError.status}` }
    const id = await waitForNewMessage({ mailpitUrl, email, knownIds })
    if (!id) return { passed: false, failure: 'no_mail' }
    const credential = extractCredential({ body: await messageBody({ mailpitUrl, id }) })
    await deleteMessages({ mailpitUrl, ids: [id] })
    if (!credential) return { passed: false, failure: 'no_credential_in_mail' }
    const params = { token_hash: credential.tokenHash, type: credential.type as 'magiclink' }
    const result = await verifyPaced({ client: anon, params, pace })
    await signOutLocal({ client: anon })
    return result.ok ? { passed: true } : { passed: false, failure: `verify:${result.reason}` }
  } catch (error) {
    return { passed: false, failure: error instanceof Error ? error.message : 'thrown' }
  }
}
