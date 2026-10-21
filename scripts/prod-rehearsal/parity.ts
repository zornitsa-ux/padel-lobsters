// Prod-data rehearsal sign-in and data-access parity (docs/pin-auth-removal/PLAN.md §4.5).
//
//   node scripts/prod-rehearsal/parity.ts --record <label> [--compare <label>] [--details]
//
// Local stack only. Signs in every real-email account with an admin-issued code, runs the
// fixed READS as that account, and stores one hash per account and read outside the repo.
// Output is counts only; --details adds account ids (uuids) to the comparison.
import { parseArgs } from 'node:util'
import type { SupabaseClient } from '@supabase/supabase-js'
import { firstTournamentId, listAuthUsers, splitAccounts, type Account } from './parity-accounts.ts'
import {
  compareRecords,
  formatComparison,
  hasDifferences,
  type AccountRecord,
  type ParityRecord,
} from './parity-compare.ts'
import { checkEmailPath, pickEmailPathAccounts } from './parity-email-path.ts'
import { readLocalStack, type LocalStack } from './parity-env.ts'
import { claimsOutcome, summarizeRead, type ReadOutcome } from './parity-normalize.ts'
import { READS } from './parity-reads.ts'
import {
  VERIFY_GAP_MS,
  adminClient,
  anonClient,
  createPacer,
  signInWithAdminCode,
  signOutLocal,
} from './parity-signin.ts'
import { loadRecord, saveRecord } from './parity-store.ts'

const CLAIMS_READ = 'token:claims'

async function runRead({ run }: { run: () => PromiseLike<ReadOutcome> }): Promise<ReadOutcome> {
  try {
    return await run()
  } catch {
    return { data: null, error: { code: 'thrown' } }
  }
}

async function readAll({
  client,
  accessToken,
  userId,
  tournamentId,
}: {
  client: SupabaseClient
  accessToken: string
  userId: string
  tournamentId: string
}): Promise<AccountRecord['reads']> {
  const context = { client, userId, tournamentId }
  const entries = await Promise.all(
    READS.map(async ({ name, run }) => {
      const outcome = await runRead({ run: () => run(context) })
      return [name, summarizeRead({ outcome })] as const
    }),
  )
  const claims = summarizeRead({ outcome: claimsOutcome({ accessToken }) })
  return Object.fromEntries([...entries, [CLAIMS_READ, claims]])
}

async function recordAccount({
  stack,
  admin,
  account,
  tournamentId,
  pace,
}: {
  stack: LocalStack
  admin: SupabaseClient
  account: Account
  tournamentId: string
  pace: () => Promise<void>
}): Promise<AccountRecord> {
  const anon = anonClient({ stack })
  const result = await signInWithAdminCode({ admin, anon, email: account.email, pace })
  if (!result.ok) return { signedIn: false, failure: result.reason, reads: {} }
  const reads = await readAll({
    client: anon,
    accessToken: result.session.access_token,
    userId: account.id,
    tournamentId,
  })
  await signOutLocal({ client: anon })
  return { signedIn: true, reads }
}

async function recordEmailPath({
  stack,
  accounts,
  pace,
}: {
  stack: LocalStack
  accounts: Account[]
  pace: () => Promise<void>
}) {
  const results: ParityRecord['mailpit'] = {}
  for (const { id, email } of pickEmailPathAccounts({ accounts })) {
    const anon = anonClient({ stack })
    results[id] = await checkEmailPath({ anon, mailpitUrl: stack.mailpitUrl, email, pace })
  }
  return results
}

function countBy({ values }: { values: string[] }): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1
  return counts
}

function printSummary({ record, synthetic }: { record: ParityRecord; synthetic: number }) {
  const accounts = Object.values(record.accounts)
  const failures = accounts.flatMap((account) => (account.failure ? [account.failure] : []))
  const email = Object.values(record.mailpit)
  console.log(`accounts total: ${accounts.length + synthetic}`)
  console.log(`  real email: ${accounts.length}, skipped synthetic: ${synthetic}`)
  console.log(`  signed in: ${accounts.filter((account) => account.signedIn).length}`)
  console.log(`  failed: ${failures.length} ${JSON.stringify(countBy({ values: failures }))}`)
  console.log(`reads per account: ${READS.length + 1}`)
  console.log(`mailpit codes: ${email.filter((r) => r.passed).length}/${email.length} passed`)
}

async function record({ label, stack }: { label: string; stack: LocalStack }) {
  const admin = adminClient({ stack })
  const split = splitAccounts({ users: await listAuthUsers({ admin }) })
  const tournamentId = await firstTournamentId({ admin })
  const pace = createPacer({ gapMs: VERIFY_GAP_MS })

  console.log(`accounts: ${split.total}, real email: ${split.real.length}`)
  const mailpit = await recordEmailPath({ stack, accounts: split.real, pace })
  console.log(`mailpit codes checked: ${Object.keys(mailpit).length}`)

  const accounts: ParityRecord['accounts'] = {}
  for (const [index, account] of split.real.entries()) {
    accounts[account.id] = await recordAccount({ stack, admin, account, tournamentId, pace })
    if ((index + 1) % 10 === 0) console.log(`processed ${index + 1}/${split.real.length}`)
  }
  const result: ParityRecord = { label, recordedAt: new Date().toISOString(), accounts, mailpit }
  saveRecord({ record: result })
  printSummary({ record: result, synthetic: split.synthetic })
  return result
}

function compare({
  before,
  after,
  details,
}: {
  before: ParityRecord
  after: ParityRecord
  details: boolean
}) {
  const comparison = compareRecords({ before, after })
  console.log(`\ncomparison with "${before.label}"`)
  for (const line of formatComparison({ comparison, details })) console.log(line)
  return hasDifferences({ comparison })
}

async function main() {
  const { values } = parseArgs({
    options: {
      record: { type: 'string' },
      compare: { type: 'string' },
      details: { type: 'boolean', default: false },
    },
  })
  if (!values.record)
    throw new Error('usage: parity.ts --record <label> [--compare <label>] [--details]')
  const before = values.compare ? loadRecord({ label: values.compare }) : null
  const after = await record({ label: values.record, stack: readLocalStack() })
  if (before && compare({ before, after, details: values.details })) process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'parity failed')
  process.exitCode = 2
})
