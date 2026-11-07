import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './settingsKeys'
import { fetchSettings, saveSettings } from './settingsQueries'
import { useApp } from '../../context/useApp'

export function useSettings() {
  const signedIn = !!useApp().session
  return useQuery({
    queryKey: settingsKeys.view({ signedIn }),
    queryFn: () => fetchSettings({ signedIn }),
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
