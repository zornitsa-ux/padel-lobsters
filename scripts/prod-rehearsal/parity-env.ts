import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface LocalStack {
  apiUrl: string
  anonKey: string
  serviceKey: string
  mailpitUrl: string
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function assertLocalUrl({ url, what }: { url: string; what: string }): void {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error(`${what} isn't a URL`)
  }
  if (!LOCAL_HOSTS.has(host)) throw new Error(`refusing to run: ${what} isn't local`)
}

function requireString({ status, key }: { status: Record<string, unknown>; key: string }): string {
  const value = status[key]
  if (typeof value !== 'string' || !value) throw new Error(`supabase status has no ${key}`)
  return value
}

export function readLocalStack(): LocalStack {
  const cli = path.join(repoRoot, 'node_modules/.bin/supabase')
  const status = JSON.parse(execFileSync(cli, ['status', '-o', 'json'], { encoding: 'utf8' }))
  const stack = {
    apiUrl: requireString({ status, key: 'API_URL' }),
    anonKey: requireString({ status, key: 'ANON_KEY' }),
    serviceKey: requireString({ status, key: 'SERVICE_ROLE_KEY' }),
    mailpitUrl: requireString({ status, key: 'MAILPIT_URL' }),
  }
  assertLocalUrl({ url: stack.apiUrl, what: 'the API URL' })
  assertLocalUrl({ url: stack.mailpitUrl, what: 'the Mailpit URL' })
  return stack
}
