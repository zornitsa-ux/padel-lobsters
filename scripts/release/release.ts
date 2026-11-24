// Production release: preflight, plan, confirm, apply, verify (docs/release/DESIGN.md).
//
//   npm run release:plan                              read-only: what would ship
//   npm run release                                   ship it (interactive, main only)
//   npm run release -- --functions-first              deploy functions before migrations
//   npm run release -- --redeploy-functions           deploy every function, not just stale ones
//
// A person runs this at a terminal. It refuses without a TTY and has no flag that skips the
// confirmation, so an agent or CI job cannot ship by accident.
import { execFileSync, type StdioOptions } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import {
  buildPlan,
  checkVerified,
  ciVerdict,
  formatPlan,
  isEmptyPlan,
  parseFunctionList,
  parseMigrationList,
  type CiRun,
  type LocalFunction,
  type ReleasePlan,
} from './plan.ts'

const root = new URL('../..', import.meta.url).pathname
const supabaseCli = `${root}node_modules/.bin/supabase`
const functionsDir = `${root}supabase/functions`

type Exec = { cmd: string; args: string[]; inherit?: boolean }

function exec({ cmd, args, inherit = false }: Exec): string {
  const stdio: StdioOptions = inherit ? 'inherit' : ['ignore', 'pipe', 'inherit']
  const out = execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio })
  return out ?? ''
}

const cli = ({ args, inherit }: { args: string[]; inherit?: boolean }) =>
  exec({ cmd: supabaseCli, args, inherit })
const git = ({ args }: { args: string[] }) => exec({ cmd: 'git', args }).trim()
const remoteJson = ({ args }: { args: string[] }): unknown =>
  JSON.parse(cli({ args: [...args, '--remote', '--output-format', 'json'] }))

function fail({ message, next }: { message: string; next?: string }): never {
  console.error(`\nSTOP: ${message}`)
  if (next) console.error(`Next: ${next}`)
  process.exit(1)
}

function step({ title }: { title: string }) {
  console.log(`\n== ${title}`)
}

function checkGit() {
  const branch = git({ args: ['rev-parse', '--abbrev-ref', 'HEAD'] })
  if (branch !== 'main')
    fail({ message: `on '${branch}', not main`, next: 'git checkout main && git pull' })
  if (git({ args: ['status', '--porcelain'] }))
    fail({ message: 'working tree has uncommitted changes' })
  git({ args: ['fetch', '--quiet', 'origin', 'main'] })
  if (git({ args: ['rev-parse', 'HEAD'] }) !== git({ args: ['rev-parse', 'origin/main'] })) {
    fail({
      message: 'main differs from origin/main',
      next: 'git pull (or push, if you have unmerged commits)',
    })
  }
}

function checkCli() {
  const pinned = JSON.parse(readFileSync(`${root}package.json`, 'utf8')).devDependencies.supabase
  const installed = cli({ args: ['--version'] }).trim()
  if (installed !== pinned)
    fail({ message: `CLI is ${installed}, package.json pins ${pinned}`, next: 'npm ci' })
}

function linkedProjectRef(): string {
  const file = `${root}supabase/.temp/project-ref`
  if (!existsSync(file))
    fail({ message: 'no linked project', next: 'npx supabase link --project-ref <ref>' })
  return readFileSync(file, 'utf8').trim()
}

function checkCi() {
  const sha = git({ args: ['rev-parse', 'HEAD'] })
  const json = exec({
    cmd: 'gh',
    args: ['run', 'list', '--commit', sha, '--json', 'name,status,conclusion'],
  })
  const verdict = ciVerdict({ runs: JSON.parse(json) as CiRun[] })
  console.log(`  CI: ${verdict.reason}`)
  if (!verdict.ok) fail({ message: `CI is not green on ${sha.slice(0, 7)}: ${verdict.reason}` })
}

function commitTime({ paths }: { paths: string[] }): number {
  const times = paths.map((p) => Number(git({ args: ['log', '-1', '--format=%ct', '--', p] }) || 0))
  return Math.max(0, ...times)
}

function localFunctions(): LocalFunction[] {
  if (!existsSync(functionsDir)) return []
  const shared = existsSync(`${functionsDir}/_shared`) ? ['supabase/functions/_shared'] : []
  return readdirSync(functionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !/^[_.]/.test(entry.name))
    .map(({ name }) => ({
      name,
      committedAt: commitTime({ paths: [`supabase/functions/${name}`, ...shared] }),
    }))
}

function readState() {
  return {
    migrations: parseMigrationList({ json: remoteJson({ args: ['migration', 'list'] }) }),
    remoteFunctions: parseFunctionList({ json: remoteJson({ args: ['functions', 'list'] }) }),
    localFunctions: localFunctions(),
  }
}

function planFromState({ forceFunctions }: { forceFunctions: boolean }): ReleasePlan {
  const { migrations, remoteFunctions, localFunctions } = readState()
  return buildPlan({ migrations, remoteFunctions, localFunctions, forceFunctions })
}

async function confirm({ projectRef }: { projectRef: string }) {
  if (!process.stdin.isTTY) fail({ message: 'a person must run this at a terminal (no TTY)' })
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    `\nThis changes PRODUCTION. Type the project ref (${projectRef}) to continue: `,
  )
  rl.close()
  if (answer.trim() !== projectRef)
    fail({ message: 'confirmation did not match; nothing was changed' })
}

function pushMigrations() {
  step({ title: 'Applying migrations' })
  cli({ args: ['db', 'push', '--remote', '--yes'], inherit: true })
}

function deployFunctions({ names }: { names: string[] }) {
  for (const name of names) {
    step({ title: `Deploying function ${name}` })
    cli({ args: ['functions', 'deploy', name, '--yes'], inherit: true })
  }
}

function apply({ plan, functionsFirst }: { plan: ReleasePlan; functionsFirst: boolean }) {
  const migrate = () => plan.pendingMigrations.length && pushMigrations()
  const deploy = () => deployFunctions({ names: plan.staleFunctions })
  if (functionsFirst) {
    deploy()
    migrate()
  } else {
    migrate()
    deploy()
  }
}

function succeeds({ cmd, args }: { cmd: string; args: string[] }): boolean {
  try {
    exec({ cmd, args, inherit: true })
    return true
  } catch {
    return false
  }
}

function verificationProblems(): string[] {
  step({ title: 'Verifying production' })
  const problems = checkVerified(readState())
  if (!succeeds({ cmd: `${root}scripts/dump-grants.sh`, args: ['--check', '--remote'] })) {
    problems.push('grants for anon/authenticated drifted from supabase/expected_*_grants.txt')
  }
  step({ title: 'Auth integrity counts (informational)' })
  succeeds({ cmd: `${root}scripts/prod-rehearsal/integrity.sh`, args: ['--remote'] })
  return problems
}

function verifyOrFail() {
  const problems = verificationProblems()
  if (!problems.length) return
  fail({
    message: `verification failed:\n  ${problems.join('\n  ')}`,
    next: 'never edit a failed migration; write a new one that fixes it. Fix grants drift the same way.',
  })
}

async function main() {
  const { values } = parseArgs({
    options: {
      plan: { type: 'boolean', default: false },
      'functions-first': { type: 'boolean', default: false },
      'redeploy-functions': { type: 'boolean', default: false },
    },
  })
  step({ title: 'Preflight' })
  checkGit()
  checkCli()
  checkCi()
  const projectRef = linkedProjectRef()

  step({ title: 'Plan' })
  const plan = planFromState({ forceFunctions: values['redeploy-functions'] })
  console.log(formatPlan({ plan, projectRef }))
  if (plan.remoteOnlyMigrations.length) {
    fail({
      message: `production has migrations the repo lacks: ${plan.remoteOnlyMigrations.join(', ')}`,
      next: 'git pull, or reconcile with npx supabase migration list --remote',
    })
  }
  if (values.plan) return console.log('\nPlan only; nothing was changed.')

  if (isEmptyPlan({ plan })) console.log('\nNothing to ship. Verifying production only.')
  else {
    await confirm({ projectRef })
    apply({ plan, functionsFirst: values['functions-first'] })
  }
  verifyOrFail()
  console.log('\nRelease complete and verified.')
}

await main()
