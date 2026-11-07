import { isPublicPath } from '../../lib/authPaths'

const JOIN_PATH = /^\/events\/[^/]+\/join\/?$/

// The signed-out pages before signup: the public pages (authPaths) and the join gate. /auth/*
// carries tokens, so it never counts.
const isFunnelPath = (path: string) =>
  !path.startsWith('/auth/') && (isPublicPath(path) || JOIN_PATH.test(path))

/**
 * G5b: the URL to send for a page view, or null to send nothing. Only signed-out visitors on
 * funnel pages count, as origin + path: the query and hash can carry `?email=` or tokens.
 */
export function funnelPageView({
  url,
  signedIn,
}: {
  url: string
  signedIn: boolean
}): string | null {
  if (signedIn) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const path = parsed.pathname.replace(/(.)\/$/, '$1')
  return isFunnelPath(path) ? parsed.origin + path : null
}
