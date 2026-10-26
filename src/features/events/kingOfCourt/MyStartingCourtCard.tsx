import { Crown } from 'lucide-react'
import { startingCourtLine, type MyStartingCourt } from './kotcPlayer'
import { TextButton } from '../../../components/ui/TextButton'

export default function MyStartingCourtCard({
  shown,
  startingCourt,
  onSeeAll,
}: {
  shown: boolean
  startingCourt: MyStartingCourt | null
  onSeeAll: () => void
}) {
  if (!shown) {
    return (
      <div className="card flex items-center gap-2">
        <Crown size={14} className="text-lob-muted flex-shrink-0" />
        <p className="text-sm text-lob-muted">Starting courts are shown before the start.</p>
      </div>
    )
  }
  if (!startingCourt) return null

  return (
    <div className="card flex items-center gap-3">
      <Crown size={18} className="text-lob-teal flex-shrink-0" />
      <p className="flex-1 text-sm font-semibold text-lob-dark">
        {startingCourtLine({ startingCourt })}
      </p>
      <TextButton onClick={onSeeAll}>All courts ›</TextButton>
    </div>
  )
}
