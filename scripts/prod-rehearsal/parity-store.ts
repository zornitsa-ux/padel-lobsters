import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { ParityRecord } from './parity-compare.ts'

const LABEL_PATTERN = /^[A-Za-z0-9._-]+$/

// Outside the repo. Records hold account ids and hashes, never personal data.
export const recordsDir = () => path.join(os.tmpdir(), 'padel-lobsters-parity')

export function recordPath({ label }: { label: string }): string {
  if (!LABEL_PATTERN.test(label)) throw new Error('labels may only contain letters, digits . _ -')
  return path.join(recordsDir(), `${label}.json`)
}

export function saveRecord({ record }: { record: ParityRecord }): string {
  const file = recordPath({ label: record.label })
  fs.mkdirSync(recordsDir(), { recursive: true, mode: 0o700 })
  fs.chmodSync(recordsDir(), 0o700)
  fs.writeFileSync(file, JSON.stringify(record), { mode: 0o600 })
  fs.chmodSync(file, 0o600)
  return file
}

export function loadRecord({ label }: { label: string }): ParityRecord {
  const file = recordPath({ label })
  if (!fs.existsSync(file)) throw new Error(`no record labelled "${label}"`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
