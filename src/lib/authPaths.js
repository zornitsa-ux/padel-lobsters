// ============================================================================
//  authPaths.js — single source of truth for public vs protected pages
// ============================================================================
//
//  The Padel Lobsters app does page-state routing (see App.jsx: `page` is a
//  string key into a `pages` object), so "paths" here are page keys, not URLs.
//
//  Rule: default-deny. If a page is NOT in PUBLIC_PAGES, VerificationGate
//  will show the PIN prompt to guests. If you forget to list a protected
//  page, it stays locked (safe, quiet). If you forget to list a public page
//  you get an unexpected PIN prompt (loud, caught in testing). We pick the
//  loud failure over the quiet one deliberately.
//
//  If you add a new page, add it to exactly one of these two lists. The
//  PROTECTED_PAGES list is documentation only — it is NOT used for
//  enforcement — but keeping it exhaustive makes auditing trivial.
// ============================================================================

/**
 * Pages a logged-out visitor (role === 'guest') can browse.
 *
 * Guests see a read-only slice of the data. Backend enforcement of "read-only
 * slice" lives in supabase-migration-v24-public-browsing.sql, which exposes
 * a `public_tournaments` view with PII-free columns only. Components that
 * render under a PUBLIC_PAGE must read from the public view when role is
 * 'guest', not from the raw tables.
 */
export const PUBLIC_PAGES = Object.freeze([
  'dashboard', // landing — lists upcoming events for guests. Every sub-tile
  // in the bottom nav (Events, Players, Merch, Settings) and
  // every event tile routes to a protected page, which makes
  // the VerificationGate surface the sign-in/up popup.
])

/**
 * Pages that require a valid PIN. Listed for completeness and auditability;
 * enforcement is default-deny in isPublicPage(), so this list isn't read at
 * runtime. If you add a page, put it here OR in PUBLIC_PAGES — pick one.
 */
export const PROTECTED_PAGES = Object.freeze([
  'tournament', // events listing — protected so guests get the sign-in popup
  'players', // roster (PII)
  'registration', // signing up for a tournament (writes, identity-linked)
  'payments', // payment status (identity-linked)
  'schedule', // match schedule (can include identity)
  'scores', // live score updates (writes)
  'game', // match play view (writes)
  'merch', // merch orders (identity-linked)
  'settings', // profile + admin settings
  'history', // historical records
  'league', // league management
  'transfer-accept', // recipient of a registration transfer responding to the offer
])

/**
 * Returns true if a logged-out visitor is allowed to view this page.
 * Anything not in the allowlist is gated. Unknown pages default to
 * protected — safer than trusting typos.
 */
export function isPublicPage(page) {
  return PUBLIC_PAGES.includes(page)
}

/**
 * Dev-only sanity check: catch the case where a page was added to both
 * lists, or to neither. Run from a test or a smoke check if you want.
 */
export function auditPageLists(knownPages) {
  const issues = []
  const publicSet = new Set(PUBLIC_PAGES)
  const protectedSet = new Set(PROTECTED_PAGES)

  for (const p of knownPages) {
    const isPub = publicSet.has(p)
    const isProt = protectedSet.has(p)
    if (isPub && isProt) issues.push(`'${p}' is in BOTH lists`)
    if (!isPub && !isProt) issues.push(`'${p}' is in NEITHER list (will default to protected)`)
  }
  for (const p of PUBLIC_PAGES) {
    if (!knownPages.includes(p)) issues.push(`PUBLIC_PAGES lists '${p}' but it has no component`)
  }
  for (const p of PROTECTED_PAGES) {
    if (!knownPages.includes(p)) issues.push(`PROTECTED_PAGES lists '${p}' but it has no component`)
  }
  return issues
}
