export type MigrationRow = { local: string | null; remote: string | null }
export type RemoteFunction = { name: string; updatedAt: number }
export type LocalFunction = { name: string; committedAt: number }
export type CiRun = { name: string; status: string; conclusion: string }

export type ReleasePlan = {
  pendingMigrations: string[]
  remoteOnlyMigrations: string[]
  staleFunctions: string[]
}

export type CiVerdict = { ok: boolean; reason: string }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function collectObjects({
  value,
  accept,
}: {
  value: unknown
  accept: (o: Record<string, unknown>) => boolean
}): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap((item) => collectObjects({ value: item, accept }))
  if (!isObject(value)) return []
  const nested = Object.values(value).flatMap((item) => collectObjects({ value: item, accept }))
  return accept(value) ? [value, ...nested] : nested
}

export function parseMigrationList({ json }: { json: unknown }): MigrationRow[] {
  const rows = collectObjects({ value: json, accept: (o) => 'local' in o && 'remote' in o })
  return rows.map(({ local, remote }) => ({
    local: typeof local === 'string' && local ? local : null,
    remote: typeof remote === 'string' && remote ? remote : null,
  }))
}

export function toEpochSeconds({ value }: { value: unknown }): number | null {
  if (typeof value === 'number') return value > 1e11 ? Math.floor(value / 1000) : value
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000)
}

export function parseFunctionList({ json }: { json: unknown }): RemoteFunction[] {
  const rows = collectObjects({
    value: json,
    accept: (o) =>
      (typeof o.slug === 'string' || typeof o.name === 'string') &&
      ('updated_at' in o || 'updatedAt' in o),
  })
  return rows.map((row) => {
    const name = String(row.slug ?? row.name)
    const updatedAt = toEpochSeconds({ value: row.updated_at ?? row.updatedAt })
    if (updatedAt === null) throw new Error(`function ${name} has no readable updated_at`)
    return { name, updatedAt }
  })
}

export function pendingMigrations({ rows }: { rows: MigrationRow[] }): string[] {
  return rows.filter((r) => r.local && !r.remote).map((r) => r.local as string)
}

export function remoteOnlyMigrations({ rows }: { rows: MigrationRow[] }): string[] {
  return rows.filter((r) => r.remote && !r.local).map((r) => r.remote as string)
}

export function staleFunctions({
  local,
  remote,
  force,
}: {
  local: LocalFunction[]
  remote: RemoteFunction[]
  force: boolean
}): string[] {
  const deployedAt = new Map(remote.map((fn) => [fn.name, fn.updatedAt]))
  return local
    .filter(({ name, committedAt }) => {
      const at = deployedAt.get(name)
      return force || at === undefined || at < committedAt
    })
    .map((fn) => fn.name)
}

export function buildPlan({
  migrations,
  localFunctions,
  remoteFunctions,
  forceFunctions,
}: {
  migrations: MigrationRow[]
  localFunctions: LocalFunction[]
  remoteFunctions: RemoteFunction[]
  forceFunctions: boolean
}): ReleasePlan {
  return {
    pendingMigrations: pendingMigrations({ rows: migrations }),
    remoteOnlyMigrations: remoteOnlyMigrations({ rows: migrations }),
    staleFunctions: staleFunctions({
      local: localFunctions,
      remote: remoteFunctions,
      force: forceFunctions,
    }),
  }
}

export const isEmptyPlan = ({ plan }: { plan: ReleasePlan }): boolean =>
  plan.pendingMigrations.length === 0 && plan.staleFunctions.length === 0

// Newest run per workflow wins: a re-run supersedes the failure it retried.
export function ciVerdict({ runs }: { runs: CiRun[] }): CiVerdict {
  const latest = [...new Map([...runs].reverse().map((run) => [run.name, run])).values()]
  if (latest.length === 0) return { ok: false, reason: 'no CI runs for this commit yet' }
  const open = latest.filter((run) => run.status !== 'completed')
  if (open.length)
    return { ok: false, reason: `still running: ${open.map((r) => r.name).join(', ')}` }
  const failed = latest.filter((run) => !['success', 'skipped'].includes(run.conclusion))
  if (failed.length)
    return {
      ok: false,
      reason: `not green: ${failed.map((r) => `${r.name} (${r.conclusion})`).join(', ')}`,
    }
  return { ok: true, reason: `${latest.length} workflow runs green` }
}

export function formatPlan({
  plan,
  projectRef,
}: {
  plan: ReleasePlan
  projectRef: string
}): string {
  const list = (items: string[]) =>
    items.length ? items.map((i) => `    ${i}`).join('\n') : '    none'
  return [
    `Production project: ${projectRef}`,
    `  Migrations to apply (${plan.pendingMigrations.length}):`,
    list(plan.pendingMigrations),
    `  Functions to deploy (${plan.staleFunctions.length}):`,
    list(plan.staleFunctions),
  ].join('\n')
}

export function checkVerified({
  migrations,
  remoteFunctions,
  localFunctions,
}: {
  migrations: MigrationRow[]
  remoteFunctions: RemoteFunction[]
  localFunctions: LocalFunction[]
}): string[] {
  const problems: string[] = []
  const pending = pendingMigrations({ rows: migrations })
  const remoteOnly = remoteOnlyMigrations({ rows: migrations })
  if (pending.length) problems.push(`migrations still pending: ${pending.join(', ')}`)
  if (remoteOnly.length)
    problems.push(`production has migrations missing from the repo: ${remoteOnly.join(', ')}`)
  const stale = staleFunctions({ local: localFunctions, remote: remoteFunctions, force: false })
  if (stale.length) problems.push(`functions older than main: ${stale.join(', ')}`)
  return problems
}
