#!/usr/bin/env node
// Ratchet on raw Tailwind palette colours. Per-file counts may only go down;
// see docs/design-system/TOKENS.md for the tokens to use instead.
//   node scripts/check-raw-colours.mjs           check against the baseline
//   node scripts/check-raw-colours.mjs --update  rewrite the baseline
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'src')
const BASELINE = join(ROOT, 'scripts', 'raw-colours-baseline.json')

const PALETTES =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const UTILITIES =
  'text|bg|border(?:-[trblxy])?|ring(?:-offset)?|divide|from|via|to|fill|stroke|outline|accent|caret|placeholder|decoration|shadow'
const RAW_CLASS = new RegExp(
  [
    `\\b(?:${UTILITIES})-(?:${PALETTES})-\\d{2,3}\\b`,
    `\\b(?:${UTILITIES})-\\[#[0-9a-fA-F]{3,8}\\]`,
    `\\bbg-gray-50\\b(?!0)`,
    `\\b(?:border(?:-[trblxy])?|divide)-gray-(?:100|200)\\b`,
  ].join('|'),
  'g',
)

const isSource = (name) => /\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)

const listFiles = ({ dir }) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return listFiles({ dir: path })
    return isSource(entry.name) ? [path] : []
  })

const countRaw = ({ path }) => (readFileSync(path, 'utf8').match(RAW_CLASS) ?? []).length

const currentCounts = () =>
  Object.fromEntries(
    listFiles({ dir: SRC })
      .map((path) => [relative(ROOT, path), countRaw({ path })])
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

const current = currentCounts()

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`)
  console.log(`Baseline updated: ${total(current)} raw colour classes.`)
  process.exit(0)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
const { grew, shrank } = compare({ baseline, current })

if (grew.length) {
  console.error(
    [
      'Raw Tailwind colours were added. Use a component from src/components/ui',
      'or a lob-* token instead (docs/design-system/TOKENS.md):',
      ...grew,
    ].join('\n'),
  )
  process.exit(1)
}

if (shrank.length) {
  console.error(
    [
      'Raw colour counts went down. Lock in the progress with `npm run design:baseline`',
      'and commit scripts/raw-colours-baseline.json:',
      ...shrank,
    ].join('\n'),
  )
  process.exit(1)
}

console.log(`Raw colour check passed: ${total(current)} classes, none added.`)
