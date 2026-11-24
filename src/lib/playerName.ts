// A deleted account's name, "Anonymous <Animal> #<N>" (docs/account-deletion
// C-1). The database reserves the pattern, so a match is always a deleted
// account, and it is shown whole wherever a first name would be.
const ANONYMISED_NAME = /^Anonymous [A-Z][a-z]+ #[0-9]+$/

export function isAnonymisedName(name: string | null | undefined): boolean {
  return ANONYMISED_NAME.test(String(name ?? '').trim())
}

export function firstName({
  name,
  fallback = '',
}: {
  name: string | null | undefined
  fallback?: string
}): string {
  const parts = nameParts(name)
  if (parts.length === 0) return fallback
  if (isAnonymisedName(name)) return parts.join(' ')
  return parts[0]
}

export function nameParts(name: string | null | undefined): string[] {
  const trimmed = String(name ?? '').trim()
  return trimmed ? trimmed.split(/\s+/) : []
}
