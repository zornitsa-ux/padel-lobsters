import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/useApp'
import { usePlayers } from '../players/usePlayers'
import { useRegistrations } from '../events/useRegistrations'
import { useMatches } from '../events/useMatches'
import { useConfirm } from '../../lib/confirmBus'
import * as oscarsApi from '../../api/oscars'
import { derivePhase, castVoteErrorMessage } from './oscarsPhase'
import type { OscarsPhase, OscarsSession, SessionState } from './oscarsPhase'
import { shortLabelMap } from './gameHelpers'
import type { OscarMatch } from './gameHelpers'
import { useOscarsSessionRow } from './useOscarsSessionRow'
import { useOscarResults } from './useOscarResults'
import type {
  AdminStatRow,
  CategoryRow,
  CategoryVoterRow,
  MyVoteRow,
  ResultRow,
  SessionRow,
} from './oscarsSchemas'
import type { Player, NormalisedTournament } from '../../lib/normalise'

/* ════════════════════════════════════════════════════════════════════════════
   useOscarsSession — owns all Lobster Oscars server state, fetchers, polling-
   capable loaders, and the vote/admin mutations for one tournament. The view
   components stay presentational; the container wires this hook to them.

   Loaders are returned (not all self-firing) so the container can drive the
   phase- and view-mode-dependent polling without this hook needing to know
   which view is on screen.

   Three reads go through slice hooks rather than direct api calls, because
   another surface already caches those rows under a shared key: the session row
   (`oscarKeys.session`, also read by the registration results banner), the
   shared results (`oscarKeys.results`, also read by Scores and History) and the
   tournament's matches (`matchKeys.list`, owned by the events slice).
   ════════════════════════════════════════════════════════════════════════════ */

/** A player's own vote in one category, as the tile grid renders it. */
export interface OscarVote {
  id: string
  name: string | null
}

/** The subset of a player the short-label formatter reads. */
export interface ShortNamePlayer {
  id: string | number
  name?: string | null
}

/** A category as `lobster_oscars_admin_upsert_categories` accepts it. */
export interface OscarCategoryInput {
  name: string
  icon: string
  display_order: number
}

export interface OscarsSessionState {
  isAdmin: boolean
  claimedId: string | null
  amRegistered: boolean
  phase: OscarsPhase
  regPlayers: Player[]
  shortName: (player: ShortNamePlayer | null | undefined) => string
  myVoteByCat: Record<string, OscarVote>
  session: SessionRow | null | undefined
  categories: CategoryRow[]
  matches: OscarMatch[]
  adminStats: AdminStatRow[]
  adminResults: ResultRow[]
  playerResults: ResultRow[] | null
  categoryVoters: Record<string, CategoryVoterRow[]>
  busy: boolean
  error: string | null
  setError: (message: string | null) => void
  loadSession: () => Promise<void>
  loadMyVotes: () => Promise<void>
  loadAdminStats: () => Promise<void>
  loadAdminResults: () => Promise<void>
  loadCategoryVoters: (categoryId: string) => Promise<void>
  loadPlayerResults: () => Promise<void>
  castVote: (categoryId: string, targetId: string) => Promise<boolean>
  clearVote: (categoryId: string) => Promise<boolean>
  startGame: (cats: OscarCategoryInput[]) => Promise<boolean>
  endGame: () => Promise<boolean>
  shareResults: () => Promise<boolean>
}

// `derivePhase` branches on the three timestamps only and models them as
// required-but-nullable; the Zod row types them as optional. Narrow here rather
// than loosening the phase model.
function toPhaseSession(row: SessionRow | null | undefined): SessionState {
  if (row === undefined) return undefined
  if (row === null) return null
  const session: OscarsSession = {
    id: row.id,
    started_at: row.started_at ?? null,
    closed_at: row.closed_at ?? null,
    shared_at: row.shared_at ?? null,
  }
  return session
}

export function useOscarsSession(
  tournament: NormalisedTournament | null | undefined,
): OscarsSessionState {
  const confirm = useConfirm()
  const { session: authSession } = useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = authSession?.user?.app_metadata?.role === 'admin'
  const claimedId = authSession?.user?.id ?? null
  const tournamentId = tournament?.id || ''
  const { data: regsData = [] } = useRegistrations(tournamentId || null)

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [myVotes, setMyVotes] = useState<MyVoteRow[]>([])
  const [adminStats, setAdminStats] = useState<AdminStatRow[]>([])
  const [adminResults, setAdminResults] = useState<ResultRow[]>([])
  const [categoryVoters, setCategoryVoters] = useState<Record<string, CategoryVoterRow[]>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const regs = useMemo(() => regsData.filter((r) => r.status === 'registered'), [regsData])
  const regPlayers = useMemo(
    () => players.filter((p) => regs.some((r) => r.playerId === p.id)),
    [players, regs],
  )
  const amRegistered = useMemo(
    () => !!claimedId && regs.some((r) => String(r.playerId) === String(claimedId)),
    [regs, claimedId],
  )
  const shortLabels = useMemo(() => shortLabelMap(regPlayers), [regPlayers])
  const shortName = useCallback(
    (p: ShortNamePlayer | null | undefined) =>
      shortLabels[String(p?.id)] || (p?.name || '').split(' ')[0] || p?.name || '',
    [shortLabels],
  )

  /* ── Session row (shared cache: oscarKeys.session) ────────────────────── */

  const sessionQuery = useOscarsSessionRow(tournamentId || null)
  const { refetch: refetchSession, isError: sessionIsError } = sessionQuery
  // undefined = still loading; null = loaded, no row. A refetch failure keeps
  // the last good row, matching the previous hand-rolled polling behaviour.
  const session = sessionQuery.isPending ? undefined : (sessionQuery.data ?? null)
  const sessionId = session?.id

  useEffect(() => {
    if (sessionIsError) setError('Could not load session — please refresh.')
  }, [sessionIsError])

  const loadSession = useCallback(async () => {
    await refetchSession()
  }, [refetchSession])

  const phase = useMemo(
    () => derivePhase(toPhaseSession(session), !!tournamentId),
    [session, tournamentId],
  )

  /* ── Matches for the head-to-head history (shared cache: matchKeys.list) ─ */

  const { data: matchRows = [] } = useMatches(tournamentId || null)
  const matches = useMemo<OscarMatch[]>(
    () =>
      matchRows.map((m) => ({
        round: Number(m.round ?? 0),
        team1_ids: m.team1Ids,
        team2_ids: m.team2Ids,
      })),
    [matchRows],
  )

  /* ── Shared results (shared cache: oscarKeys.results) ─────────────────── */

  // Gated on an explicit request so the container keeps driving *when* the
  // published results are fetched (play mode, shared phase) exactly as before.
  const [resultsRequested, setResultsRequested] = useState(false)
  const resultsQuery = useOscarResults(resultsRequested && tournamentId ? tournamentId : null)
  const { refetch: refetchResults, isError: resultsIsError } = resultsQuery
  const playerResults = resultsRequested ? (resultsQuery.data ?? null) : null

  useEffect(() => {
    if (resultsIsError) setError('Could not load results — please refresh.')
  }, [resultsIsError])

  const loadPlayerResults = useCallback(async () => {
    if (!tournamentId) return
    setResultsRequested(true)
    await refetchResults()
  }, [tournamentId, refetchResults])

  useEffect(() => {
    setResultsRequested(false)
  }, [tournamentId])

  const myVoteByCat = useMemo(() => {
    const m: Record<string, OscarVote> = {}
    for (const v of myVotes) m[v.category_id] = { id: v.target_id, name: v.target_name ?? null }
    return m
  }, [myVotes])

  /* ── Fetchers ─────────────────────────────────────────────────────────── */

  const loadCategories = useCallback(async (id: string | undefined) => {
    if (!id) {
      setCategories([])
      return
    }
    const { data, error: err } = await oscarsApi.loadCategories(id)
    if (err) {
      setError('Could not load categories — please refresh.')
      return
    }
    setCategories(data || [])
  }, [])

  const loadMyVotes = useCallback(async () => {
    if (!tournamentId || !authSession?.user) return
    const { data, error: err } = await oscarsApi.getMyVotes(tournamentId)
    if (err) {
      setError('Could not load your votes — please refresh.')
      return
    }
    setMyVotes(data || [])
  }, [tournamentId, authSession])

  const loadAdminStats = useCallback(async () => {
    if (!tournamentId || !isAdmin) return
    const { data, error: err } = await oscarsApi.adminGetStats(tournamentId)
    if (err) {
      setError('Could not refresh stats.')
      return
    }
    setAdminStats(data || [])
  }, [tournamentId, isAdmin])

  const loadAdminResults = useCallback(async () => {
    if (!tournamentId || !isAdmin) return
    const { data, error: err } = await oscarsApi.adminGetResults(tournamentId)
    if (err) {
      setError('Could not load results — please refresh.')
      return
    }
    setAdminResults(data || [])
  }, [tournamentId, isAdmin])

  const loadCategoryVoters = useCallback(
    async (categoryId: string) => {
      if (!categoryId || !isAdmin) return
      const { data, error: err } = await oscarsApi.adminGetCategoryVoters(categoryId)
      if (err) {
        setError('Could not load voter list.')
        return
      }
      setCategoryVoters((prev) => ({ ...prev, [categoryId]: data || [] }))
    },
    [isAdmin],
  )

  /* ── Initial load ─────────────────────────────────────────────────────── */

  // After the session loads: categories + my votes (only when a session exists)
  useEffect(() => {
    if (!sessionId) {
      setCategories([])
      setMyVotes([])
      return
    }
    loadCategories(sessionId)
    if (authSession?.user) loadMyVotes()
  }, [sessionId, authSession, loadCategories, loadMyVotes])

  /* ── Mutations ────────────────────────────────────────────────────────── */

  const castVote = useCallback(
    async (categoryId: string, targetId: string) => {
      if (busy) return false
      setBusy(true)
      setError(null)
      const { data, error: err } = await oscarsApi.castVote(categoryId, targetId)
      setBusy(false)
      if (err) {
        setError(err.message)
        return false
      }
      if (data === 'voted' || data === 'updated') {
        const targetName = players.find((p) => String(p.id) === String(targetId))?.name ?? ''
        setMyVotes((prev) => [
          ...prev.filter((v) => v.category_id !== categoryId),
          { category_id: categoryId, target_id: targetId, target_name: targetName },
        ])
        return true
      }
      // `data` is only null when `error` was set, which returned above.
      setError(castVoteErrorMessage(String(data)))
      return false
    },
    [busy, players],
  )

  const clearVote = useCallback(
    async (categoryId: string) => {
      if (!(await confirm({ message: 'Clear your vote for this category?', destructive: true })))
        return false
      setBusy(true)
      setError(null)
      const { data, error: err } = await oscarsApi.clearVote(categoryId)
      setBusy(false)
      if (err) {
        setError(err.message)
        return false
      }
      if (data === 'cleared' || data === 'no_vote') {
        setMyVotes((prev) => prev.filter((v) => v.category_id !== categoryId))
        return true
      }
      setError(`Could not clear vote: ${data}`)
      return false
    },
    [confirm],
  )

  const startGame = useCallback(
    async (cats: OscarCategoryInput[]) => {
      if (!cats || cats.length === 0) {
        setError('Add at least one category before starting.')
        return false
      }
      setBusy(true)
      setError(null)
      const { data: upRes, error: upErr } = await oscarsApi.adminUpsertCategories(
        tournamentId,
        cats,
      )
      if (upErr || (upRes !== 'ok' && upRes !== 'already_started')) {
        setBusy(false)
        setError(`Could not save categories: ${upErr?.message || upRes}`)
        return false
      }
      const { data: startRes, error: startErr } = await oscarsApi.adminStart(tournamentId)
      setBusy(false)
      if (startErr) {
        setError(startErr.message)
        return false
      }
      if (startRes === 'started' || startRes === 'already_started') {
        await loadSession()
        return true
      }
      setError(`Could not start: ${startRes}`)
      return false
    },
    [tournamentId, loadSession],
  )

  const endGame = useCallback(async () => {
    if (
      !(await confirm({
        message:
          'End voting now? Players will see a "waiting for results" screen until you press Share.',
      }))
    )
      return false
    setBusy(true)
    setError(null)
    const { data, error: err } = await oscarsApi.adminEnd(tournamentId)
    setBusy(false)
    if (err) {
      setError(err.message)
      return false
    }
    if (data === 'ended' || data === 'already_ended') {
      await loadSession()
      return true
    }
    setError(`Could not end: ${data}`)
    return false
  }, [confirm, tournamentId, loadSession])

  const shareResults = useCallback(async () => {
    if (
      !(await confirm({
        message: 'Share results with all players now? This cannot be undone.',
        destructive: true,
      }))
    )
      return false
    setBusy(true)
    setError(null)
    const { data, error: err } = await oscarsApi.adminShare(tournamentId)
    setBusy(false)
    if (err) {
      setError(err.message)
      return false
    }
    if (data === 'shared' || data === 'already_shared') {
      await loadSession()
      return true
    }
    setError(`Could not share: ${data}`)
    return false
  }, [confirm, tournamentId, loadSession])

  return {
    // identity / derived
    isAdmin,
    claimedId,
    amRegistered,
    phase,
    regPlayers,
    shortName,
    myVoteByCat,
    // server state
    session,
    categories,
    matches,
    adminStats,
    adminResults,
    playerResults,
    categoryVoters,
    // ui state
    busy,
    error,
    setError,
    // loaders (container drives phase/view-mode polling)
    loadSession,
    loadMyVotes,
    loadAdminStats,
    loadAdminResults,
    loadCategoryVoters,
    loadPlayerResults,
    // mutations
    castVote,
    clearVote,
    startGame,
    endGame,
    shareResults,
  }
}
