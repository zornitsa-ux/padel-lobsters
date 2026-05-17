// ── Name alias storage ────────────────────────────────────────────────────────
export const ALIAS_KEY = 'lobster_name_aliases'
export const SKIPPED_KEY = 'lobster_name_skipped' // pairs admin already said "different"

export function loadAliases() {
  try {
    return JSON.parse(localStorage.getItem(ALIAS_KEY) || '{}')
  } catch {
    return {}
  }
}
export function loadSkipped() {
  try {
    return JSON.parse(localStorage.getItem(SKIPPED_KEY) || '[]')
  } catch {
    return []
  }
}
export function saveAliases(a) {
  localStorage.setItem(ALIAS_KEY, JSON.stringify(a))
}
export function saveSkipped(s) {
  localStorage.setItem(SKIPPED_KEY, JSON.stringify(s))
}
export function resolveName(name, aliases) {
  return aliases[name] || name
}
