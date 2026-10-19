import type { SupabaseClient } from '@supabase/supabase-js'

export interface Account {
  id: string
  email: string
}

export interface AccountSplit {
  total: number
  real: Account[]
  synthetic: number
}

// Same definition as auth_sets.sql: non-blank and not the synthetic internal address.
export function isRealEmail({ email }: { email: string | null | undefined }): boolean {
  const trimmed = (email ?? '').trim()
  return trimmed !== '' && !/@padelobsters\.internal$/i.test(trimmed)
}

export function splitAccounts({
  users,
}: {
  users: { id: string; email?: string | null }[]
}): AccountSplit {
  const real = users
    .filter(({ email }) => isRealEmail({ email }))
    .map(({ id, email }) => ({ id, email: (email as string).trim().toLowerCase() }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  return { total: users.length, real, synthetic: users.length - real.length }
}

export async function listAuthUsers({ admin }: { admin: SupabaseClient }) {
  const users: { id: string; email?: string | null }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed: ${error.code ?? error.status}`)
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

export async function firstTournamentId({ admin }: { admin: SupabaseClient }): Promise<string> {
  const { data } = await admin.from('tournaments').select('id').order('id').limit(1)
  return data?.[0]?.id ?? '00000000-0000-0000-0000-000000000000'
}
