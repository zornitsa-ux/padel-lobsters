#!/usr/bin/env node
// No raw Tailwind palette colours or arbitrary colour values anywhere in src/. The theme is
// locked to lob-* tokens (P7c), so such a class renders nothing. ESLint's
// tailwindcss/no-custom-classname catches them in className attributes; this also catches
// class strings kept in constants. Tokens: docs/design-system/TOKENS.md.
import { countMatches } from './lib/countMatches.mjs'

const PALETTES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const UTILITIES =
  'text|bg|border(?:-[trblxy])?|ring(?:-offset)?|divide|from|via|to|fill|stroke|outline|accent|caret|placeholder|decoration|shadow'
const RAW_CLASS = new RegExp(
  [
    `\\b(?:${UTILITIES})-(?:${PALETTES})-\\d{2,3}\\b`,
    `\\b(?:${UTILITIES})-\\[(?:#|rgba?\\(|hsla?\\()`,
  ].join('|'),
  'g',
)

const found = countMatches({ include: (path) => /\.(tsx?|css)$/.test(path), pattern: RAW_CLASS })

const files = Object.entries(found)
if (files.length) {
  console.error(
    [
      'Raw Tailwind colours. The theme only has lob-* tokens, so these render nothing.',
      'Use a component from src/components/ui or a token (docs/design-system/TOKENS.md):',
      ...files.map(([file, count]) => `  ${file}: ${count}`),
    ].join('\n'),
  )
  process.exit(1)
}
console.log('Raw colour classes check passed: none in src.')
