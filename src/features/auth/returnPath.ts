import { readStorage, removeStorage, writeStorage } from '../../lib/safeStorage'

const STORAGE_KEY = 'pl_auth_return_path'

export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith('/')) return false
  return !path.startsWith('//') && !path.startsWith('/\\')
}

export function saveReturnPath(): void {
  const { pathname, search, hash } = window.location
  writeStorage({ area: 'local', key: STORAGE_KEY, value: pathname + search + hash })
}

export function takeReturnPath(): string | null {
  const path = readStorage({ area: 'local', key: STORAGE_KEY })
  removeStorage({ area: 'local', key: STORAGE_KEY })
  return isSafeReturnPath(path) ? path : null
}
