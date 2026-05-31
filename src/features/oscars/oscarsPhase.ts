/* ════════════════════════════════════════════════════════════════════════════
   Lobster Oscars — pure phase + view-mode logic (no React, no Supabase).
   Kept side-effect free so it can be unit-tested in the node test environment.
   ════════════════════════════════════════════════════════════════════════════ */

/** A row from `lobster_oscars_sessions` (only the timestamps we branch on). */
export type OscarsSession = {
  id: string
  started_at: string | null
  closed_at: string | null
  shared_at: string | null
}

/**
 * Session loading sentinel:
 *   undefined → not loaded yet (show spinner)
 *   null      → loaded, no row exists for this tournament
 */
export type SessionState = OscarsSession | null | undefined

export type OscarsPhase = 'loading' | 'not_created' | 'pre_start' | 'active' | 'ended' | 'shared'

/**
 * Derive the lifecycle phase from the loaded session.
 *   not_created  → no row
 *   pre_start    → row exists, started_at IS NULL  (admin still configuring)
 *   active       → started_at set, closed_at NULL  (voting open)
 *   ended        → closed_at set, shared_at NULL   (admin sees rankings, players wait)
 *   shared       → shared_at set                   (results visible to players)
 */
export function derivePhase(session: SessionState, hasTournament: boolean): OscarsPhase {
  if (!hasTournament) return 'loading'
  if (session === undefined) return 'loading'
  if (session === null) return 'not_created'
  if (!session.started_at) return 'pre_start'
  if (!session.closed_at) return 'active'
  if (!session.shared_at) return 'ended'
  return 'shared'
}

export type ViewMode = 'admin' | 'play'

/**
 * The default view for a viewer when no explicit toggle override is set.
 *
 * - Non-admins always play (the view-mode toggle is admin-only).
 * - Admins who are NOT registered for the tournament only get admin controls —
 *   they have no one to vote as.
 * - Registered admins land where they most likely need to be at each phase:
 *   configuring/ending → admin controls; voting/results open → play view.
 */
export function defaultViewMode(opts: {
  isAdmin: boolean
  amRegistered: boolean
  phase: OscarsPhase
}): ViewMode {
  const { isAdmin, amRegistered, phase } = opts
  if (!isAdmin) return 'play'
  if (!amRegistered) return 'admin'
  return phase === 'active' || phase === 'shared' ? 'play' : 'admin'
}

/** Whether the admin view-mode toggle should be offered at all. */
export function canToggleViewMode(opts: { isAdmin: boolean; amRegistered: boolean }): boolean {
  return opts.isAdmin && opts.amRegistered
}

const CAST_VOTE_ERRORS: Record<string, string> = {
  invalid_pin: 'Sign-in expired — please re-enter your PIN.',
  self_vote: "You can't vote for yourself.",
  not_started: "Voting hasn't started yet.",
  closed: 'Voting has closed.',
  invalid_category: 'That category no longer exists.',
  invalid_target: "That player isn't registered for this tournament.",
  voter_not_registered: "You're not registered for this tournament.",
}

/** Map a `lobster_oscars_cast_vote` status code to a friendly message. */
export function castVoteErrorMessage(code: string): string {
  return CAST_VOTE_ERRORS[code] || `Vote failed: ${code}`
}
