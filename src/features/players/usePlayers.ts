import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { playerKeys, playerPiiKeys } from './playerKeys'
import {
  fetchPlayers,
  fetchMyProfile,
  fetchPlayerPii,
  uploadAvatar,
  type Player,
} from './playerQueries'
import * as mut from './playerQueries'
import type { PlayerInput } from './playerQueries'
import { mergeMyProfile } from './playerSelectors'

// Full redacted roster. One shared cache across every list view — TanStack
// Query dedupes concurrent callers, so it doesn't matter how many components
// mount this. Replaces the global AppContext `players` array + 60s poll.
//
// staleTime 5min: the roster barely changes mid-tournament, so we don't need
// the global 30s default. Writes already invalidate playerKeys.all(), so
// post-write freshness is preserved without focus-triggered refetches.
const ROSTER_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: false,
} as const

export function usePlayers() {
  return useQuery({ queryKey: playerKeys.list(), queryFn: fetchPlayers, ...ROSTER_OPTIONS })
}

// Start the roster request before React mounts. Declared here so it can't drift
// from usePlayers' key/fetcher/staleTime — a mismatch on any of the three would
// make the hook refetch and cost a request rather than save one.
export function prefetchPlayers(qc: QueryClient): void {
  void qc.prefetchQuery({ queryKey: playerKeys.list(), queryFn: fetchPlayers, ...ROSTER_OPTIONS })
}

// One player derived from the shared roster cache via `select` — no extra
// network request, and structural sharing means a component watching player X
// only re-renders when X changes (the win over useMemo(find) on a context array).
export function usePlayer(id: string | null | undefined) {
  return useQuery({
    queryKey: playerKeys.list(),
    queryFn: fetchPlayers,
    enabled: !!id,
    select: (list: Player[]) => list.find((p) => p.id === id) ?? null,
    ...ROSTER_OPTIONS,
  })
}

// The signed-in user's own profile. Identity (name, avatar, level) always comes
// from the public roster; PII (email, phone, full birthday) overlays from
// get_my_profile_v2 when available. A signed-in claimed player always has a
// row there — a null result now means the read failed to produce PII, not an
// acceptable steady state, so callers must treat it like an error, not "no PII".
// refetchOnWindowFocus is OFF so returning to the tab can't stomp an in-progress
// edit on the Settings form.
export function useMyProfile(id: string | null | undefined) {
  const base = usePlayer(id)
  const pii = useQuery({
    queryKey: playerKeys.me(),
    queryFn: fetchMyProfile,
    enabled: !!id,
    refetchOnWindowFocus: false,
  })

  const data = useMemo<Player | null>(
    () => mergeMyProfile(base.data, pii.data),
    [base.data, pii.data],
  )

  const isLoading = base.isLoading || pii.isLoading
  // True only once the PII overlay has actually resolved to a row. A
  // successful call that returns no row is a genuine "PII unavailable"
  // state and must block seeding/saving the same as isError does.
  const hasPii = pii.isSuccess && pii.data != null

  return {
    data,
    isLoading,
    isError: base.isError || pii.isError,
    hasPii,
    // Settled, and PII still isn't here — a failed read OR a success with no
    // row. Both leave the form unseedable, so the caller must say so rather
    // than sit on "Loading…" forever.
    piiUnavailable: !!id && !hasPii && !isLoading && !pii.isFetching,
  }
}

// Admin-only, single-player PII read — scoped to exactly the player being
// looked at, never the whole roster (see admin_get_player_pii /
// supabase/migrations/20260816120000_scoped_player_pii.sql). Every call is
// an explicit action (revealing a row, opening the edit form, resolving a
// merge candidate), never a page-mount side effect — `enabled` is the caller
// declaring "I actually need this player's PII right now".
//
// Every successful call writes a pin_attempts audit row keyed on the player
// being read, so this deliberately does not refetch on focus. staleTime
// matches the old roster-wide overlay's 5min; gcTime is shorter than the
// default (2min) so a revealed-then-hidden/collapsed player's PII leaves
// memory promptly instead of lingering — least retention, not just least
// fetch. retry is off: a require_admin() rejection or a missing row won't
// succeed on retry, and every retry is another audited read.
//
// Declared once so usePlayerPii and useEnsurePlayerPii can never drift on
// key/fetcher/staleTime — see prefetchPlayers above for why that matters.
const PII_QUERY = (id: string) => ({
  queryKey: playerPiiKeys.detail(id),
  queryFn: () => fetchPlayerPii(id),
  staleTime: 5 * 60 * 1000,
  gcTime: 2 * 60 * 1000,
  refetchOnWindowFocus: false,
  retry: false,
})

export function usePlayerPii({ id, enabled }: { id: string | null; enabled: boolean }) {
  return useQuery({ ...PII_QUERY(id ?? ''), enabled: enabled && !!id })
}

// Imperative accessor for call sites that must not proceed until a specific
// player's PII has actually resolved (opening a player for edit, resolving a
// merge/link candidate). Resolves from cache if usePlayerPii already has
// fresh data for that id, otherwise awaits the in-flight/new fetch — and,
// critically, REJECTS if the fetch fails, instead of a mounted useQuery's
// `data: undefined` which looks identical to "still loading" or "no PII".
export function useEnsurePlayerPii() {
  const qc = useQueryClient()
  return useCallback(
    // revalidateIfStale defaults to false, which would silently serve
    // pre-write cached PII to a write path (e.g. reopening Edit right after
    // an admin save) instead of refetching it.
    (id: string) => qc.ensureQueryData({ ...PII_QUERY(id), revalidateIfStale: true }),
    [qc],
  )
}

// Drops a player's cached PII immediately — called on drawer collapse, on a
// "Hide" tap, or when a modal that revealed it closes. Progressive reveal
// means revocable: a value the admin chose to look at shouldn't sit in
// memory (or refetch on some unrelated later mount) once they're done with
// it. Omit `id` to clear every cached player's PII (used on sign-out).
export function useForgetPlayerPii() {
  const qc = useQueryClient()
  return useCallback(
    (id?: string, { onlyIfUnobserved = false }: { onlyIfUnobserved?: boolean } = {}) => {
      // onlyIfUnobserved guards the automatic unmount purge: a component
      // unmounting must not blank a sibling surface (e.g. a still-open
      // PendingApprovalsList row) that's showing the same player's PII —
      // that immediately re-triggers another audited read. By the time this
      // runs from useRevealPii's unmount cleanup, this component's own
      // usePlayerPii observer has already unsubscribed (its cleanup runs
      // first — registered earlier in the hook), so any remaining observer
      // genuinely belongs to another surface. An explicit hide()/sign-out
      // forget is a deliberate action and always purges.
      if (id && onlyIfUnobserved) {
        const query = qc.getQueryCache().find({ queryKey: playerPiiKeys.detail(id) })
        if (query && query.getObserversCount() > 0) return
      }
      qc.removeQueries({ queryKey: id ? playerPiiKeys.detail(id) : playerPiiKeys.all() })
    },
    [qc],
  )
}

// No cache to invalidate — the returned URL goes into the form and is
// persisted by the following addPlayer/updatePlayer call.
export function useAvatarUpload() {
  return useMutation({ mutationFn: uploadAvatar })
}

// Only the signed-in user's id is read here — every write is re-authorised
// server-side by require_admin() or auth.uid().
export function usePlayerActions({
  session,
  role,
}: {
  session: { user?: { id: string } | null } | null
  role: string
}) {
  const qc = useQueryClient()
  const invalidatePlayers = useCallback(
    () => qc.invalidateQueries({ queryKey: playerKeys.all() }),
    [qc],
  )

  const addPlayer = useCallback(
    async (data: PlayerInput) => {
      if (!session?.user) throw new Error('Admin sign-in required to add a player.')
      const inserted = await mut.addPlayer(data)
      if (!inserted) throw new Error('Could not save player. Check your admin sign-in.')
      await invalidatePlayers()
      return { ok: true, data: inserted }
    },
    [session, invalidatePlayers],
  )

  const updatePlayer = useCallback(
    async (id: string, data: PlayerInput) => {
      if (role !== 'admin' && String(id) !== String(session?.user?.id)) {
        throw new Error('Not authorized to edit this player')
      }
      await mut.updatePlayer(id, data, role)
      await invalidatePlayers()
      // Only THIS player's cached PII, not the whole playerPiiKeys space — an
      // unrelated write (renaming someone else, approving a different
      // signup) must not cause a revealed-and-still-open row to refetch.
      // Marks stale rather than removing: a currently-open reveal refreshes
      // (correct — it's the admin's own write), a closed one just goes
      // stale and refetches next time it's opened.
      await qc.invalidateQueries({ queryKey: playerPiiKeys.detail(id) })
      return { ok: true }
    },
    [session, role, invalidatePlayers, qc],
  )

  const deletePlayer = useCallback(
    async (id: string) => {
      await mut.deletePlayer(id)
      await invalidatePlayers()
      // Removed outright, not just invalidated — never refetch PII for a
      // player who no longer exists.
      qc.removeQueries({ queryKey: playerPiiKeys.detail(id) })
      return { ok: true }
    },
    [invalidatePlayers, qc],
  )

  const regeneratePin = useCallback(
    async (playerId: string) => {
      const data = await mut.regeneratePin(playerId)
      if (!data) throw new Error('Could not reset PIN.')
      await invalidatePlayers()
      return { ok: true, pin: data }
    },
    [invalidatePlayers],
  )

  return { addPlayer, updatePlayer, deletePlayer, regeneratePin }
}
