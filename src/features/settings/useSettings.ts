import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsKeys } from './settingsKeys'
import { fetchSettings, saveSettings } from './settingsQueries'
import { useApp } from '../../context/useApp'

export function useSettings() {
  const { session, sessionSettled } = useApp()
  const signedIn = !!session
  return useQuery({
    queryKey: settingsKeys.view({ signedIn }),
    queryFn: () => fetchSettings({ signedIn }),
    // Before auth settles a returning member looks signed out: wait, rather
    // than fetch the guest columns and then the member ones.
    enabled: sessionSettled,
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
