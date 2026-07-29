// ── Name alias storage ────────────────────────────────────────────────────────
export const ALIAS_KEY = 'lobster_name_aliases'
export const SKIPPED_KEY = 'lobster_name_skipped' // pairs admin already said "different"

// historical name → canonical name
export type AliasMap = Record<string, string>

export function loadAliases(): AliasMap {
  try {
    return JSON.parse(localStorage.getItem(ALIAS_KEY) || '{}') as AliasMap
  } catch {
    return {}
  }
}
// Shape is unknown: nothing currently reads these entries back (see
// ARCHITECTURE.md — the alias-review UI they belonged to is an open question).
export function loadSkipped(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(SKIPPED_KEY) || '[]') as unknown[]
  } catch {
    return []
  }
}
export function saveAliases(a: AliasMap): void {
  localStorage.setItem(ALIAS_KEY, JSON.stringify(a))
}
export function saveSkipped(s: unknown[]): void {
  localStorage.setItem(SKIPPED_KEY, JSON.stringify(s))
}
export function resolveName(name: string, aliases: AliasMap): string {
  return aliases[name] || name
}
