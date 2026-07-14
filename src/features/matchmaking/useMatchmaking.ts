import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { matchKeys } from '../events/matchKeys'
import { playerKeys } from '../players/playerKeys'
import {
  applyTournamentRatings,
  fetchRatingReviewQueue,
  reviewRatingEvent,
} from './applyTournamentRatings.service'
import { commitSchedule } from './generateSchedule.service'
import { matchmakingKeys } from './matchmakingKeys'

export function useRatingReviewQueue() {
  return useQuery({
    queryKey: matchmakingKeys.reviewQueue(),
    queryFn: fetchRatingReviewQueue,
  })
}

// Commit a previewed run: writes matches + records the run. Invalidates the
// tournament's match list (schedule changed) and its schedule-run history.
export function useCommitSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: commitSchedule,
    onSuccess: (_data, { run }) => {
      qc.invalidateQueries({ queryKey: matchKeys.list(run.tournamentId) })
      qc.invalidateQueries({ queryKey: matchmakingKeys.scheduleRuns(run.tournamentId) })
    },
  })
}

// Applying ratings moves mm_* and populates the review queue.
export function useApplyTournamentRatings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: applyTournamentRatings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchmakingKeys.reviewQueue() })
      qc.invalidateQueries({ queryKey: playerKeys.all() })
    },
  })
}

export function useReviewRatingEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reviewRatingEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchmakingKeys.reviewQueue() })
      qc.invalidateQueries({ queryKey: playerKeys.all() })
    },
  })
}
