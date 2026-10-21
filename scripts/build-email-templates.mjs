// Renders supabase/templates/*.html from one shared layout plus per-template copy.
//   node scripts/build-email-templates.mjs          write the files
//   node scripts/build-email-templates.mjs --check  fail if the committed files differ
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import { renderSource } from './email-templates/layout.mjs'
import { TEMPLATES } from './email-templates/copy.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = (name) => path.join(root, 'supabase', 'templates', `${name}.html`)

async function render(name) {
  const filepath = outputPath(name)
  const options = (await prettier.resolveConfig(filepath)) ?? {}
  return prettier.format(renderSource(TEMPLATES[name]), { ...options, filepath })
}

function diff({ name, expected }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'email-templates-'))
  const rendered = path.join(dir, `${name}.html`)
  writeFileSync(rendered, expected)
  const { stdout } = spawnSync('diff', ['-u', outputPath(name), rendered], { encoding: 'utf8' })
  rmSync(dir, { recursive: true })
  return stdout
}

async function main() {
  const check = process.argv.includes('--check')
  let stale = 0
  for (const name of Object.keys(TEMPLATES)) {
    const expected = await render(name)
    const current = readFileSync(outputPath(name), 'utf8')
    if (current === expected) continue
    if (!check) writeFileSync(outputPath(name), expected)
    else {
      stale += 1
      console.error(diff({ name, expected }))
    }
  }
  if (stale > 0) {
    console.error(
      `${stale} email template(s) differ from scripts/email-templates. Run \`npm run templates:build\` and commit the result.`,
    )
    process.exit(1)
  }
}

main()
