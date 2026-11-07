import { readStorage, removeStorage, writeStorage } from '../../lib/safeStorage'

const STORAGE_KEY = 'pl_auth_return_path'

export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith('/')) return false
  return !path.startsWith('//') && !path.startsWith('/\\')
}

/** Drops the sign-in deep link's `?signin=1&email=` from a query string. */
export function withoutDeepLinkParams({ search }: { search: string }): string {
  const params = new URLSearchParams(search)
  params.delete('signin')
  params.delete('email')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// The current page without the sign-in deep link's ?signin/&email, so an
// address never travels in a return path or an email link.
const currentPath = () =>
  window.location.pathname + withoutDeepLinkParams({ search: window.location.search })

export function saveReturnPath(): void {
  writeStorage({ area: 'local', key: STORAGE_KEY, value: currentPath() + window.location.hash })
}

export function takeReturnPath(): string | null {
  const path = readStorage({ area: 'local', key: STORAGE_KEY })
  removeStorage({ area: 'local', key: STORAGE_KEY })
  return isSafeReturnPath(path) ? path : null
}

/**
 * The page an auth email should return to, as an absolute URL. GoTrue checks it
 * against the redirect allow-list and hands it to the template as RedirectTo,
 * or swaps in the site URL when it isn't allowed. No hash: GoTrue may drop it.
 */
export function emailReturnUrl(): string {
  return window.location.origin + currentPath()
}

/**
 * Reads an email link's `return_to` (RedirectTo) back into a path. Only the
 * path is kept, so it never leaves the app. The bare site URL and /auth/ pages
 * fall through, so the caller uses `next` instead.
 */
export function returnPathFromUrl({ url }: { url: string | null | undefined }): string | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.pathname === '/' || parsed.pathname.startsWith('/auth/')) return null
  const path = parsed.pathname + parsed.search
  return isSafeReturnPath(path) ? path : null
}
