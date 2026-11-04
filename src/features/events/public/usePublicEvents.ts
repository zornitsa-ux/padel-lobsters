import { useQuery } from '@tanstack/react-query'
import { fetchPublicEvents } from './publicEventQueries'

export const publicEventKeys = {
  all: () => ['public-events'] as const,
}

export function usePublicEvents() {
  return useQuery({ queryKey: publicEventKeys.all(), queryFn: fetchPublicEvents })
}
