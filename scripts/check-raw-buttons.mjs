#!/usr/bin/env node
// Ratchet on hand-built <button>s outside src/components/ui. Per-file counts may
// only go down; see "Need X → use Y" in docs/design-system/PLAN.md.
//   node scripts/check-raw-buttons.mjs           check against the baseline
//   node scripts/check-raw-buttons.mjs --update  rewrite the baseline
import { runRatchet } from './lib/ratchet.mjs'

runRatchet({
  name: 'Hand-built buttons',
  baselineFile: 'raw-buttons-baseline.json',
  include: (path) =>
    path.endsWith('.tsx') && !path.startsWith('src/components/ui/') && !path.endsWith('.test.tsx'),
  pattern: /<button\b/g,
  grewHelp: [
    'Hand-built <button>s were added. Use Button, TextButton, IconButton or another',
    'component from src/components/ui (docs/design-system/PLAN.md, "Need X → use Y"):',
  ].join('\n'),
})
