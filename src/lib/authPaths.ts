// ============================================================================
//  authPaths.js — single source of truth for public vs protected routes
// ============================================================================
//
//  Rule: default-deny. If a path is NOT in PUBLIC_PATHS, VerificationGate
//  shows the PIN prompt to guests. Forgetting to allowlist a public path is
//  a loud failure (unexpected PIN prompt, caught in testing). Forgetting to
//  list a protected path is a quiet failure (still locked). We pick loud
//  over quiet deliberately.
// ============================================================================

/**
 * URL path prefixes that a logged-out visitor (role === 'guest') can browse.
 *
 * Match rule: a path is public if it equals or starts-with any prefix listed
 * here (boundaries enforced — '/home/foo' matches '/home', '/homer' does not).
 *
 * Backend enforcement of "guest can read" lives in the public_* views in
 * Supabase. Components rendering under a public path read from those views
 * when role is 'guest'.
 */
export const PUBLIC_PATHS = Object.freeze([
  '/', // root redirect
  '/home', // landing — every protected sub-tile triggers the sign-in popup
  '/auth/confirm', // magic-link landing — must be reachable without a session
])

/**
 * URL path prefixes that require authentication. Documentation only — the
 * runtime enforcement is default-deny in isPublicPath().
 */
export const PROTECTED_PATHS = Object.freeze([
  '/events', // tournament list + detail + sub-tabs (schedule/scores/payments/oscars)
  '/community', // roster + per-player profile
  '/merch', // merch orders + raffle
  '/settings', // profile + admin
  '/history', // historical tournaments
  '/league', // Lobster League
  '/transfer', // accept-spot-transfer deep link
])

const matchesPrefix = (pathname, prefix) => {
  if (pathname === prefix) return true
  if (prefix === '/') return false // '/' only matches the root literal
  return pathname.startsWith(prefix + '/')
}

/**
 * Returns true if a logged-out visitor is allowed to view this URL path.
 * Default-deny — anything not allowlisted is treated as protected.
 */
export function isPublicPath(pathname) {
  if (!pathname) return false
  return PUBLIC_PATHS.some((p) => matchesPrefix(pathname, p))
}
