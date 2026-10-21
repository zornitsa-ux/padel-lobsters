import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { LocalStack } from './parity-env.ts'

export type SignInResult = { ok: true; session: Session } | { ok: false; reason: string }

type AuthFailure = { code?: string | null; status?: number | null }

const RATE_LIMIT_RETRIES = 3
const RATE_LIMIT_BACKOFF_MS = 30_000
// token_verifications is 150 per 5 minutes per IP locally: one verification per 2s, plus margin.
export const VERIFY_GAP_MS = 2200

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const reasonOf = ({ error }: { error: AuthFailure }) => error.code || `status_${error.status}`
const isRateLimited = ({ error }: { error: AuthFailure }) =>
  error.status === 429 || (error.code ?? '').includes('rate_limit')

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}

export const anonClient = ({ stack }: { stack: LocalStack }) =>
  createClient(stack.apiUrl, stack.anonKey, clientOptions)

export const adminClient = ({ stack }: { stack: LocalStack }) =>
  createClient(stack.apiUrl, stack.serviceKey, clientOptions)

export function createPacer({ gapMs }: { gapMs: number }) {
  let last = 0
  return async () => {
    const wait = last + gapMs - Date.now()
    if (wait > 0) await sleep(wait)
    last = Date.now()
  }
}

type VerifyParams = Parameters<SupabaseClient['auth']['verifyOtp']>[0]

export async function verifyPaced({
  client,
  params,
  pace,
}: {
  client: SupabaseClient
  params: VerifyParams
  pace: () => Promise<void>
}): Promise<SignInResult> {
  for (let attempt = 0; ; attempt++) {
    await pace()
    const { data, error } = await client.auth.verifyOtp(params)
    if (!error && data.session) return { ok: true, session: data.session }
    if (!error) return { ok: false, reason: 'no_session' }
    if (!isRateLimited({ error }) || attempt >= RATE_LIMIT_RETRIES) {
      return { ok: false, reason: reasonOf({ error }) }
    }
    await sleep(RATE_LIMIT_BACKOFF_MS)
  }
}

export async function signInWithAdminCode({
  admin,
  anon,
  email,
  pace,
}: {
  admin: SupabaseClient
  anon: SupabaseClient
  email: string
  pace: () => Promise<void>
}): Promise<SignInResult> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) return { ok: false, reason: `generate_link:${reasonOf({ error })}` }
  const token = data.properties.email_otp
  return verifyPaced({ client: anon, params: { email, token, type: 'email' }, pace })
}

export async function signOutLocal({ client }: { client: SupabaseClient }) {
  await client.auth.signOut({ scope: 'local' })
}
