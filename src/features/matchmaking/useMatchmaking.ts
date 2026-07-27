import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { matchKeys } from '../events/matchKeys'
import { playerKeys } from '../players/playerKeys'
import {
  applyTournamentRatings,
  fetchRatingReviewQueue,
  reviewRatingEvent,
} from './applyTournamentRatings.service'
import { commitSchedule, fetchMmRatings } from './generateSchedule.service'
import { matchmakingKeys } from './matchmakingKeys'

// Flagged, unresolved rating events across all tournaments (admin-only via
// RLS). `enabled` avoids the query for non-admin/non-V2 views, matching
// useMmRatings below.
export function useRatingReviewQueue({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: matchmakingKeys.reviewQueue(),
    queryFn: fetchRatingReviewQueue,
    enabled,
  })
}

// Learned priors for seeding the matcher and the next rating update. Admin-only
// (require_admin inside the RPC), so `enabled` keeps non-admins from firing a
// call that would only 403. Applying ratings and reviewing events both
// invalidate this alongside the review queue.
export function useMmRatings({ enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: matchmakingKeys.mmRatings(),
    queryFn: fetchMmRatings,
    enabled,
  })
}

// Commit a previewed run: writes matches + records the run. Invalidates the
// tournament's match list (schedule changed) and its schedule-run history.
// Renders its error inline (MatchmakingContainer's alert banner keyed off
// commit.isError) — suppress the global toast so a failed save isn't
// reported twice.
export function useCommitSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: commitSchedule,
    onSuccess: (_data, { run }) => {
      qc.invalidateQueries({ queryKey: matchKeys.list(run.tournamentId) })
      qc.invalidateQueries({ queryKey: matchmakingKeys.scheduleRuns(run.tournamentId) })
    },
    meta: { suppressErrorToast: true },
  })
}

// Applying ratings moves mm_* and populates the review queue.
export function useApplyTournamentRatings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: applyTournamentRatings,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchmakingKeys.reviewQueue() })
      qc.invalidateQueries({ queryKey: matchmakingKeys.mmRatings() })
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
      qc.invalidateQueries({ queryKey: matchmakingKeys.mmRatings() })
      qc.invalidateQueries({ queryKey: playerKeys.all() })
    },
  })
}
