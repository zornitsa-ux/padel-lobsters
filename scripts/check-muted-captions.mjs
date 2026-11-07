#!/usr/bin/env node
// 12px secondary text uses .caption (lob-slate), not text-xs with lob-muted / lob-muted-light,
// which fail WCAG AA at that size. Weighted labels, uppercase overlines and monospace numbers
// aren't captions and are left out. src/components/ui sets its own type. See TOKENS.md.
import { countMatches } from './lib/countMatches.mjs'

// A decorative glyph, not text: the Lobster Way accordion chevron.
const ALLOWED = { 'src/features/lobster-way/LobsterWay.tsx': 1 }

const NOT_A_CAPTION = String.raw`\b(?:font-(?:medium|semibold|bold)|uppercase|font-mono)\b`
const MUTED_SMALL_TEXT = new RegExp(
  String.raw`(["'\x60])(?=[^"'\x60]*\btext-xs\b)(?=[^"'\x60]*\btext-lob-muted(?:-light)?(?![-\w/]))(?![^"'\x60]*${NOT_A_CAPTION})[^"'\x60]*\1`,
  'g',
)

const found = countMatches({
  include: (path) =>
    /\.tsx?$/.test(path) && !path.startsWith('src/components/ui/') && !/\.test\.tsx?$/.test(path),
  pattern: MUTED_SMALL_TEXT,
})

const files = Object.entries(found).filter(([file, count]) => count > (ALLOWED[file] ?? 0))
if (files.length) {
  console.error(
    [
      'Small muted text built by hand (text-xs with lob-muted or lob-muted-light).',
      'Use the .caption class (docs/design-system/TOKENS.md):',
      ...files.map(([file, count]) => `  ${file}: ${count}`),
    ].join('\n'),
  )
  process.exit(1)
}
console.log('Muted captions check passed: small secondary text uses .caption.')
