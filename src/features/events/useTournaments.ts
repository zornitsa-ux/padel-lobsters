import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tournamentKeys } from './tournamentKeys'
import {
  fetchTournaments,
  addTournament,
  updateTournament,
  deleteTournament,
} from './tournamentQueries'

export function useTournaments() {
  return useQuery({
    queryKey: tournamentKeys.all(),
    queryFn: fetchTournaments,
  })
}

export function useAddTournament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addTournament,
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.all() }),
  })
}

export function useUpdateTournament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateTournament(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.all() }),
  })
}

export function useDeleteTournament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTournament(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.all() }),
  })
}
