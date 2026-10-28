// Per-file count ratchet for the design checks: counts may only go down.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SRC = join(ROOT, 'src')

const listFiles = ({ dir, include }) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listFiles({ dir: path, include })
    return include(relative(ROOT, path)) ? [path] : []
  })

/** Per-file match counts under src/, files with no match left out. */
export const countMatches = ({ include, pattern }) =>
  Object.fromEntries(
    listFiles({ dir: SRC, include })
      .map((path) => [
        relative(ROOT, path),
        (readFileSync(path, 'utf8').match(pattern) ?? []).length,
      ])
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  )

const compare = ({ baseline, current }) => {
  const files = new Set([...Object.keys(baseline), ...Object.keys(current)])
  const grew = []
  const shrank = []
  for (const file of files) {
    const was = baseline[file] ?? 0
    const now = current[file] ?? 0
    if (now > was) grew.push(`  ${file}: ${was} → ${now}`)
    if (now < was) shrank.push(`  ${file}: ${was} → ${now}`)
  }
  return { grew, shrank }
}

const total = (counts) => Object.values(counts).reduce((sum, n) => sum + n, 0)

/**
 * `--update` rewrites the baseline. Otherwise exits 1 if any file grew (`grewHelp`) or
 * shrank without the baseline being updated, so progress is locked in.
 */
export function runRatchet({ name, baselineFile, include, pattern, grewHelp }) {
  const baselinePath = join(ROOT, 'scripts', baselineFile)
  const current = countMatches({ include, pattern })

  if (process.argv.includes('--update')) {
    writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
    console.log(`Baseline updated: ${total(current)} ${name}.`)
    return
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const { grew, shrank } = compare({ baseline, current })

  if (grew.length) {
    console.error([grewHelp, ...grew].join('\n'))
    process.exit(1)
  }
  if (shrank.length) {
    console.error(
      [
        `${name} went down. Lock in the progress with \`npm run design:baseline\``,
        `and commit scripts/${baselineFile}:`,
        ...shrank,
      ].join('\n'),
    )
    process.exit(1)
  }
  console.log(`${name} check passed: ${total(current)}, none added.`)
}
