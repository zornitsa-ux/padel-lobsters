/**
 * G5b: the signed-out steps before signup, the only page views sent to Vercel Web Analytics.
 * Signups and registrations are counted in Supabase; members are never tracked.
 */
const FUNNEL_PATHS: readonly RegExp[] = [
  /^\/(home)?$/, // landing
  /^\/events$/, // upcoming events list
  /^\/events\/[^/]+$/, // a shared event link
  /^\/events\/[^/]+\/info$/, // event details
  /^\/events\/[^/]+\/join$/, // tapped "Join to play" or "Sign in"
]

/**
 * The URL to send for a page view, or null to send nothing. Only signed-out visitors on funnel
 * pages count, and the query string and hash are dropped: they can carry an email (`?email=`)
 * or tokens.
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
  return FUNNEL_PATHS.some((re) => re.test(path)) ? parsed.origin + path : null
}
