#!/usr/bin/env node
// Ratchet on raw Tailwind palette colours. Per-file counts may only go down;
// see docs/design-system/TOKENS.md for the tokens to use instead.
//   node scripts/check-raw-colours.mjs           check against the baseline
//   node scripts/check-raw-colours.mjs --update  rewrite the baseline
import { runRatchet } from './lib/ratchet.mjs'

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

runRatchet({
  name: 'Raw colour classes',
  baselineFile: 'raw-colours-baseline.json',
  include: (path) => /\.(tsx?|css)$/.test(path) && !/\.test\.tsx?$/.test(path),
  pattern: RAW_CLASS,
  grewHelp: [
    'Raw Tailwind colours were added. Use a component from src/components/ui',
    'or a lob-* token instead (docs/design-system/TOKENS.md):',
  ].join('\n'),
})
