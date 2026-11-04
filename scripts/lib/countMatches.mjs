// Per-file match counts for the design checks.
import { readFileSync, readdirSync } from 'node:fs'
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
