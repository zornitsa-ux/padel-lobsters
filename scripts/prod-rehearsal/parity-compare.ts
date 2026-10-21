import type { ReadResult } from './parity-normalize.ts'

export interface AccountRecord {
  signedIn: boolean
  failure?: string
  reads: Record<string, ReadResult>
}

export interface ParityRecord {
  label: string
  recordedAt: string
  accounts: Record<string, AccountRecord>
  mailpit: Record<string, { passed: boolean; failure?: string }>
}

export interface ReadDiff {
  changed: string[]
  rowsBefore: number
  rowsAfter: number
}

export interface Comparison {
  signInRegressed: string[]
  signInRecovered: string[]
  accountsGone: string[]
  accountsNew: string[]
  readsAdded: string[]
  readsRemoved: string[]
  reads: Record<string, ReadDiff>
}

const signedIn = ({ record, id }: { record: ParityRecord; id: string }) =>
  record.accounts[id]?.signedIn === true

const ids = ({ record }: { record: ParityRecord }) => Object.keys(record.accounts).sort()

function readNames({ record }: { record: ParityRecord }): Set<string> {
  return new Set(
    Object.values(record.accounts)
      .filter((account) => account.signedIn)
      .flatMap((account) => Object.keys(account.reads)),
  )
}

function diffRead({
  name,
  before,
  after,
  commonIds,
}: {
  name: string
  before: ParityRecord
  after: ParityRecord
  commonIds: string[]
}): ReadDiff {
  const diff: ReadDiff = { changed: [], rowsBefore: 0, rowsAfter: 0 }
  for (const id of commonIds) {
    const old = before.accounts[id].reads[name]
    const now = after.accounts[id].reads[name]
    diff.rowsBefore += old?.rows ?? 0
    diff.rowsAfter += now?.rows ?? 0
    if (old?.hash !== now?.hash) diff.changed.push(id)
  }
  return diff
}

export function compareRecords({
  before,
  after,
}: {
  before: ParityRecord
  after: ParityRecord
}): Comparison {
  const beforeIds = ids({ record: before })
  const afterIds = new Set(ids({ record: after }))
  const commonIds = beforeIds.filter(
    (id) => signedIn({ record: before, id }) && signedIn({ record: after, id }),
  )
  const beforeNames = readNames({ record: before })
  const afterNames = readNames({ record: after })
  const commonNames = [...beforeNames].filter((name) => afterNames.has(name)).sort()
  return {
    signInRegressed: beforeIds.filter(
      (id) => signedIn({ record: before, id }) && !signedIn({ record: after, id }),
    ),
    signInRecovered: beforeIds.filter(
      (id) => !signedIn({ record: before, id }) && signedIn({ record: after, id }),
    ),
    accountsGone: beforeIds.filter((id) => !afterIds.has(id)),
    accountsNew: [...afterIds].filter((id) => !before.accounts[id]).sort(),
    readsAdded: [...afterNames].filter((name) => !beforeNames.has(name)).sort(),
    readsRemoved: [...beforeNames].filter((name) => !afterNames.has(name)).sort(),
    reads: Object.fromEntries(
      commonNames.map((name) => [name, diffRead({ name, before, after, commonIds })]),
    ),
  }
}

export function hasDifferences({ comparison }: { comparison: Comparison }): boolean {
  return (
    comparison.signInRegressed.length > 0 ||
    comparison.readsAdded.length > 0 ||
    comparison.readsRemoved.length > 0 ||
    Object.values(comparison.reads).some((diff) => diff.changed.length > 0)
  )
}

export function formatComparison({
  comparison,
  details,
}: {
  comparison: Comparison
  details: boolean
}): string[] {
  const list = (title: string, items: string[]) => [
    `${title}: ${items.length}`,
    ...(details ? items.map((id) => `  ${id}`) : []),
  ]
  const readLines = Object.entries(comparison.reads).flatMap(([name, diff]) => [
    `read ${name}: ${diff.changed.length} changed, rows ${diff.rowsBefore} -> ${diff.rowsAfter} (${diff.rowsAfter - diff.rowsBefore})`,
    ...(details ? diff.changed.map((id) => `  ${id}`) : []),
  ])
  return [
    ...list('signed in before, not now', comparison.signInRegressed),
    ...list('not signed in before, signed in now', comparison.signInRecovered),
    `accounts gone since the earlier record: ${comparison.accountsGone.length}`,
    `accounts new since the earlier record: ${comparison.accountsNew.length}`,
    `reads added: ${comparison.readsAdded.length}`,
    `reads removed: ${comparison.readsRemoved.length}`,
    ...readLines,
  ]
}
