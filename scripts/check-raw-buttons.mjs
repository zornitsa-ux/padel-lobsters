#!/usr/bin/env node
// No hand-built <button>s outside src/components/ui: features compose Button, TextButton,
// IconButton, Chip, OptionRow, MenuItem, CardLink and the rest. See "Need X → use Y" in
// docs/design-system/PLAN.md.
import { countMatches } from './lib/ratchet.mjs'

const found = countMatches({
  include: (path) =>
    path.endsWith('.tsx') && !path.startsWith('src/components/ui/') && !path.endsWith('.test.tsx'),
  pattern: /<button\b/g,
})

const files = Object.entries(found)
if (files.length) {
  console.error(
    [
      'Hand-built <button>s outside src/components/ui. Use a component from src/components/ui',
      '(docs/design-system/PLAN.md, "Need X → use Y"), or add the variant it needs:',
      ...files.map(([file, count]) => `  ${file}: ${count}`),
    ].join('\n'),
  )
  process.exit(1)
}
console.log('Hand-built buttons check passed: none outside src/components/ui.')
