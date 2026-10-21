import { createHash } from 'node:crypto'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export interface ReadOutcome {
  data: unknown
  error: { code?: string | null; status?: number | null } | null
}

export interface ReadResult {
  hash: string
  rows: number
  error?: string
}

// Change on every sign-in or write, so they'd flag differences that aren't regressions.
const VOLATILE_COLUMNS = new Set(['updated_at', 'last_sign_in_at', 'last_seen_at'])
const VOLATILE_CLAIMS = new Set(['iat', 'exp', 'session_id', 'amr'])

export function canonicalize({ value, omit }: { value: unknown; omit: ReadonlySet<string> }): Json {
  if (Array.isArray(value)) return value.map((item) => canonicalize({ value: item, omit }))
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([key]) => !omit.has(key))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => [key, canonicalize({ value: item, omit })] as const)
    return Object.fromEntries(entries)
  }
  return value === undefined ? null : (value as Json)
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

function toRows(data: unknown): unknown[] {
  if (data === null || data === undefined) return []
  return Array.isArray(data) ? data : [data]
}

export function normalizeRows({ data }: { data: unknown }): string[] {
  return toRows(data)
    .map((row) => JSON.stringify(canonicalize({ value: row, omit: VOLATILE_COLUMNS })))
    .sort()
}

export function errorCode({ error }: { error: NonNullable<ReadOutcome['error']> }): string {
  return error.code || `http_${error.status ?? 'unknown'}`
}

export function summarizeRead({ outcome }: { outcome: ReadOutcome }): ReadResult {
  if (outcome.error) {
    const error = errorCode({ error: outcome.error })
    return { hash: sha256(`error:${error}`), rows: 0, error }
  }
  const rows = normalizeRows({ data: outcome.data })
  return { hash: sha256(JSON.stringify(rows)), rows: rows.length }
}

export function decodeJwtPayload({ token }: { token: string }): Record<string, unknown> {
  const payload = token.split('.')[1] ?? ''
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

export function claimsOutcome({ accessToken }: { accessToken: string }): ReadOutcome {
  const claims = canonicalize({
    value: decodeJwtPayload({ token: accessToken }),
    omit: VOLATILE_CLAIMS,
  })
  return { data: claims, error: null }
}
