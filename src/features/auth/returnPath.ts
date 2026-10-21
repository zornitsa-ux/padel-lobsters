const STORAGE_KEY = 'pl_auth_return_path'

export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith('/')) return false
  return !path.startsWith('//') && !path.startsWith('/\\')
}

export function saveReturnPath(): void {
  try {
    const { pathname, search, hash } = window.location
    window.localStorage.setItem(STORAGE_KEY, pathname + search + hash)
  } catch {
    /* storage blocked: sign-in falls back to /home */
  }
}

export function takeReturnPath(): string | null {
  try {
    const path = window.localStorage.getItem(STORAGE_KEY)
    window.localStorage.removeItem(STORAGE_KEY)
    return isSafeReturnPath(path) ? path : null
  } catch {
    return null
  }
}
