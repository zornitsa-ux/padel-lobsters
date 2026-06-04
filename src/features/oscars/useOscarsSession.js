import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import { usePlayers } from '../players/usePlayers'
import * as oscarsApi from '../../api/oscars'
import { derivePhase, castVoteErrorMessage } from './oscarsPhase'
import { shortLabelMap } from './gameHelpers'

/* ════════════════════════════════════════════════════════════════════════════
   useOscarsSession — owns all Lobster Oscars server state, fetchers, polling-
   capable loaders, and the vote/admin mutations for one tournament. The view
   components stay presentational; the container wires this hook to them.

   Loaders are returned (not all self-firing) so the container can drive the
   phase- and view-mode-dependent polling without this hook needing to know
   which view is on screen.
   ════════════════════════════════════════════════════════════════════════════ */
export function useOscarsSession(tournament) {
  const { session: authSession, getTournamentRegistrations } = useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = authSession?.user?.app_metadata?.role === 'admin'
  const claimedId = authSession?.user?.id ?? null
  const tournamentId = tournament?.id || ''

  const [session, setSession] = useState(undefined) // undefined = unloaded; null = no row
  const [categories, setCategories] = useState([])
  const [myVotes, setMyVotes] = useState([])
  const [adminStats, setAdminStats] = useState([])
  const [adminResults, setAdminResults] = useState([])
  const [playerResults, setPlayerResults] = useState(null) // null = unloaded; [] = loaded
  const [matches, setMatches] = useState([])
  const [categoryVoters, setCategoryVoters] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const regs = useMemo(
    () => getTournamentRegistrations(tournamentId).filter((r) => r.status === 'registered'),
    [getTournamentRegistrations, tournamentId],
  )
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
    (p) => shortLabels[String(p?.id)] || (p?.name || '').split(' ')[0] || p?.name || '',
    [shortLabels],
  )

  const phase = useMemo(() => derivePhase(session, !!tournamentId), [session, tournamentId])

  const myVoteByCat = useMemo(() => {
    const m = {}
    for (const v of myVotes) m[v.category_id] = { id: v.target_id, name: v.target_name }
    return m
  }, [myVotes])

  /* ── Fetchers ─────────────────────────────────────────────────────────── */

  const loadSession = useCallback(async () => {
    if (!tournamentId) return
    const { data, error: err } = await oscarsApi.loadSession(tournamentId)
    if (err) {
      // Exit the loading spinner on initial load; keep current state during polling
      setSession((prev) => (prev === undefined ? null : prev))
      setError('Could not load session — please refresh.')
      return
    }
    setSession(data || null)
  }, [tournamentId])

  const loadCategories = useCallback(async (sessionId) => {
    if (!sessionId) {
      setCategories([])
      return
    }
    const { data, error: err } = await oscarsApi.loadCategories(sessionId)
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
    async (categoryId) => {
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

  const loadPlayerResults = useCallback(async () => {
    if (!tournamentId) return
    const { data, error: err } = await oscarsApi.getResults(tournamentId)
    if (err) {
      setError('Could not load results — please refresh.')
      return
    }
    setPlayerResults(data || [])
  }, [tournamentId])

  const loadMatches = useCallback(async () => {
    if (!tournamentId) return
    const data = await oscarsApi.loadOscarMatches(tournamentId)
    setMatches(data)
  }, [tournamentId])

  /* ── Initial load ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!tournamentId) return
    setSession(undefined)
    loadSession()
    loadMatches()
  }, [tournamentId, loadSession, loadMatches])

  // After session loads, fetch categories + my votes
  useEffect(() => {
    if (!session?.id) {
      setCategories([])
      setMyVotes([])
      return
    }
    loadCategories(session.id)
    if (authSession?.user) loadMyVotes()
  }, [session?.id, authSession, loadCategories, loadMyVotes])

  /* ── Mutations ────────────────────────────────────────────────────────── */

  const castVote = useCallback(
    async (categoryId, targetId) => {
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
      setError(castVoteErrorMessage(data))
      return false
    },
    [busy, players],
  )

  const clearVote = useCallback(async (categoryId) => {
    if (!window.confirm('Clear your vote for this category?')) return false
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
  }, [])

  const startGame = useCallback(
    async (cats) => {
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
      !window.confirm(
        'End voting now? Players will see a "waiting for results" screen until you press Share.',
      )
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
  }, [tournamentId, loadSession])

  const shareResults = useCallback(async () => {
    if (!window.confirm('Share results with all players now? This cannot be undone.')) return false
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
  }, [tournamentId, loadSession])

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
