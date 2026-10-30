import { Trophy } from 'lucide-react'
import { EmptyState } from '../../../components/ui/EmptyState'
import { TextButton } from '../../../components/ui/TextButton'

export function LeagueNotFound() {
  return (
    <EmptyState
      icon={<Trophy />}
      title="League not found"
      action={<TextButton to="/league/seasons">View all seasons →</TextButton>}
    />
  )
}
