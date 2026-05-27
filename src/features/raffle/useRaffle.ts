import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { raffleKeys } from './raffleKeys'
import {
  fetchWinners,
  drawWinners,
  fetchExclusions,
  fetchIneligible,
  setExclusions,
  updateWinnerPrize,
  deleteWinner,
} from './raffleQueries'

// Committed winners for one tournament.
export function useRaffleWinners(tournamentId: string | null | undefined) {
  return useQuery({
    queryKey: raffleKeys.winners(tournamentId ?? ''),
    queryFn: () => fetchWinners(tournamentId as string),
    enabled: !!tournamentId,
  })
}

// Atomic fair draw — picks AND records winners in one call. A draw is final,
// so this is a mutation (an explicit, consequential user action), not a query.
export function useDrawWinners() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      tournamentId,
      numWinners,
      prizes,
    }: {
      tournamentId: string
      numWinners: number
      prizes?: (string | null)[]
    }) => drawWinners(tournamentId, numWinners, prizes),
    onSuccess: () => qc.invalidateQueries({ queryKey: raffleKeys.all() }),
  })
}

// Admin-excluded player ids for a tournament.
export function useExclusions(tournamentId: string | null | undefined) {
  return useQuery({
    queryKey: raffleKeys.exclusions(tournamentId ?? ''),
    queryFn: () => fetchExclusions(tournamentId as string),
    enabled: !!tournamentId,
  })
}

// Players the draw auto-skips (cooldown / already won here) for this tournament.
export function useIneligible(tournamentId: string | null | undefined) {
  return useQuery({
    queryKey: raffleKeys.ineligible(tournamentId ?? ''),
    queryFn: () => fetchIneligible(tournamentId as string),
    enabled: !!tournamentId,
  })
}

export function useSetExclusions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tournamentId, playerIds }: { tournamentId: string; playerIds: string[] }) =>
      setExclusions(tournamentId, playerIds),
    onSuccess: (_data, { tournamentId }) =>
      qc.invalidateQueries({ queryKey: raffleKeys.exclusions(tournamentId) }),
  })
}

export function useUpdateWinnerPrize() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ winnerId, prize }: { winnerId: string; prize: string }) =>
      updateWinnerPrize(winnerId, prize),
    onSuccess: () => qc.invalidateQueries({ queryKey: raffleKeys.all() }),
  })
}

export function useDeleteWinner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (winnerId: string) => deleteWinner(winnerId),
    onSuccess: () => qc.invalidateQueries({ queryKey: raffleKeys.all() }),
  })
}
