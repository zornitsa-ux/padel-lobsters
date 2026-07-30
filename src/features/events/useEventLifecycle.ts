import { useMemo, useState } from 'react'
import { usePlayers } from '../players/usePlayers'
import { useMatches } from './useMatches'
import { useRegistrations } from './useRegistrations'
import { useUpdateTournament } from './useTournaments'
import {
  buildRatingUpdatePayload,
  isRatingsAlreadyAppliedError,
} from '../matchmaking/applyTournamentRatings.service'
import { initialRating } from '../matchmaking/domain/rating/model'
import {
  useApplyTournamentRatings,
  useMmRatings,
  useRatingReviewQueue,
  useReviewRatingEvent,
} from '../matchmaking/useMatchmaking'
import { errorMessage } from '../../lib/errors'
import type { MatchResult } from '../matchmaking/domain/types'
import type { RatingReviewProps } from '../matchmaking/ui/RatingReview'
import type { NormalisedTournament } from '../../lib/normalise'

/**
 * The event's lifecycle writes, in one place: finish, reveal, publish raffle
 * winners, and the flagged-rating review queue.
 *
 * Lifted out of Schedule.tsx so the run-of-show owns them and there is exactly
 * one completion control in the app — the Info tab's second "Mark Tournament as
 * Complete" button wrote `status` without applying ratings, and because
 * Schedule's correct Finish was gated on `!isTournamentCompleted`, using the
 * wrong one made the right one disappear and stranded that event's learned
 * ratings silently.
 *
 * The rating-application body is moved verbatim from Schedule.tsx; how ratings
 * are computed is deliberately untouched.
 */
export function useEventLifecycle({ tournament }: { tournament: NormalisedTournament }) {
  const updateTournament = useUpdateTournament().mutateAsync
  const { data: players = [] } = usePlayers()
  const { data: regsData = [] } = useRegistrations(tournament.id)
  const { data: savedMatches = [] } = useMatches(tournament.id)

  const regs = useMemo(() => regsData.filter((r) => r.status === 'registered'), [regsData])
  const registeredPlayers = useMemo(() => {
    const registeredIds = new Set(regs.map((reg) => String(reg.playerId)))
    return players.filter((player) => registeredIds.has(String(player.id)))
  }, [players, regs])

  // The learned prior comes from the admin-only RPC, not the roster: mm_* is
  // excluded from players_public (DESIGN §5), so reading it off `players` would
  // always be null and every event would re-seed from playtomic_level.
  const { data: mmRatings } = useMmRatings({ enabled: true })
  // Re-derived on mount rather than relying on post-Finish component state:
  // a flagged rating_events row (flagged=true, review_status=null) stays
  // unresolved until an admin acts on it, so it must stay reachable across a
  // navigate-away or refresh, not just for the session that created it.
  const { data: reviewQueueAll } = useRatingReviewQueue({ enabled: true })
  const reviewQueue = useMemo(
    () => (reviewQueueAll || []).filter((e) => e.tournament_id === String(tournament.id)),
    [reviewQueueAll, tournament.id],
  )
  const playerNamesById = useMemo(
    () => Object.fromEntries(registeredPlayers.map((p) => [String(p.id), p.name])),
    [registeredPlayers],
  )

  const applyRatingsMutation = useApplyTournamentRatings()
  const reviewMutation = useReviewRatingEvent()

  // Count of adjustments auto-applied without review on THIS Finish action.
  // Session-only (unlike the queue, this has no persisted source to re-derive
  // from post-refresh), so it's null except right after a same-session Finish.
  const [appliedCount, setAppliedCount] = useState<number | null>(null)
  const [busy, setBusy] = useState<null | 'finish' | 'reveal' | 'publish'>(null)
  const [error, setError] = useState('')

  // Priors are the ratings used to generate — the learned mm_* when the engine
  // has seen the player, else the playtomic-level prior — read from the same
  // admin RPC that seeded the roster so the chain compounds instead of
  // restarting each event. Applied BEFORE marking completed so a failure leaves
  // the tournament finishable again.
  const applyRatings = async () => {
    const ratingPlayers = registeredPlayers.map((p) => {
      const learned = mmRatings?.[String(p.id)]
      const prior = learned ?? initialRating({ playtomicLevel: p.playtomicLevel ?? 0 })
      return {
        playerId: String(p.id),
        mu: prior.mu,
        sigma: prior.sigma,
        playtomicLevel: p.playtomicLevel ?? 0,
        previousDeltas: [],
      }
    })
    // Padel is always 2v2, so the pairs are read off positionally — MatchResult
    // types both teams as a 2-tuple.
    const matches: MatchResult[] = []
    for (const m of savedMatches || []) {
      const { score1, score2 } = m
      if (score1 == null || score2 == null) continue
      const [t1a, t1b] = (m.team1Ids || []).map(String)
      const [t2a, t2b] = (m.team2Ids || []).map(String)
      matches.push({
        matchId: String(m.id),
        // `matches.round` is nullable; 1 is the column's own default.
        round: m.round ?? 1,
        team1: [t1a, t1b],
        team2: [t2a, t2b],
        score1,
        score2,
      })
    }
    const payload = buildRatingUpdatePayload({
      tournamentId: String(tournament.id),
      players: ratingPlayers,
      matches,
    })
    await applyRatingsMutation.mutateAsync(payload)
    // Only set once persisted: on a retry after the RPC's double-apply guard
    // rejects a repeat call, this freshly-recomputed payload no longer
    // matches what was actually written the first time, so it must not
    // overwrite the "auto-applied" count with a number that never landed.
    setAppliedCount(payload.updates.filter((u) => !u.flagged).length)
  }

  const finishTournament = async () => {
    setBusy('finish')
    setError('')
    try {
      try {
        await applyRatings()
      } catch (err) {
        // A prior Finish click can have applied ratings successfully and
        // then failed on the status update below — the RPC's double-apply
        // guard then rejects every retry's apply step, permanently
        // blocking completion even though there's nothing left to apply.
        // Treat "already applied" as done and proceed to mark completed;
        // any other error still aborts (caught below).
        if (!isRatingsAlreadyAppliedError(err)) throw err
      }
      await updateTournament({
        id: tournament.id,
        data: { status: 'completed', completedAt: new Date().toISOString() },
      })
      return true
    } catch (err) {
      setError(errorMessage(err, 'Could not finish tournament.'))
      return false
    } finally {
      setBusy(null)
    }
  }

  // D-029: independent of rating review — an admin can reveal before, after,
  // or interleaved with resolving flagged ratings.
  const revealResults = async () => {
    setBusy('reveal')
    setError('')
    try {
      await updateTournament({
        id: tournament.id,
        data: { resultsSharedAt: new Date().toISOString() },
      })
      return true
    } catch (err) {
      setError(errorMessage(err, 'Could not reveal results.'))
      return false
    } finally {
      setBusy(null)
    }
  }

  const publishRaffleWinners = async () => {
    setBusy('publish')
    setError('')
    try {
      await updateTournament({
        id: tournament.id,
        data: { rafflePublishedAt: new Date().toISOString() },
      })
      return true
    } catch (err) {
      setError(errorMessage(err, 'Could not publish raffle winners.'))
      return false
    } finally {
      setBusy(null)
    }
  }

  const reviewRating: RatingReviewProps['onReview'] = async ({ eventId, action, delta }) => {
    try {
      await reviewMutation.mutateAsync({ eventId, action, delta })
    } catch (err) {
      setError(errorMessage(err, 'Could not record review.'))
    }
  }

  return {
    finishTournament,
    revealResults,
    publishRaffleWinners,
    reviewRating,
    reviewing: reviewMutation.isPending,
    reviewQueue,
    playerNamesById,
    appliedCount,
    busy,
    error,
    setError,
  }
}
