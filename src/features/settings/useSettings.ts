import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './settingsKeys'
import { fetchSettings, saveSettings } from './settingsQueries'

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all(),
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSaveSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: saveSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all() }),
  })
}
