import { CollapsibleCard } from '../../components/ui/CollapsibleCard'
import { ProgressBar } from '../../components/ui/ProgressBar'
import type { AdminStatRow, CategoryVoterRow } from './oscarsSchemas'

interface StatRowProps {
  stat: AdminStatRow
  expanded: boolean
  voters: CategoryVoterRow[] | undefined
  onToggle: () => void
}

/* ─── Admin: per-category live participation row ──────────────────────── */
export default function StatRow({ stat, expanded, voters, onToggle }: StatRowProps) {
  const pct =
    stat.total_participants > 0 ? Math.round((stat.votes_count / stat.total_participants) * 100) : 0
  const voted = (voters || []).filter((v) => v.voted)
  const notVoted = (voters || []).filter((v) => !v.voted)
  return (
    <CollapsibleCard
      className="card space-y-2"
      expanded={expanded}
      onToggle={onToggle}
      header={
        <span className="flex-1 min-w-0 block space-y-2">
          <span className="flex items-center gap-2">
            <span className="text-lg">{stat.category_icon}</span>
            <span className="flex-1 font-semibold text-sm text-lob-slate">
              {stat.category_name}
            </span>
            <span className="text-xs text-lob-muted font-semibold">
              <span className="text-lob-teal text-base font-bold">{stat.votes_count}</span> of{' '}
              {stat.total_participants} voted
            </span>
          </span>
          <ProgressBar value={pct} fillClassName="bg-gradient-to-r from-lob-teal to-lob-coral" />
        </span>
      }
    >
      <div className="pt-2 border-t border-lob-line grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xs uppercase font-bold text-lob-success tracking-wide mb-1">
            ✓ Voted ({voted.length})
          </p>
          <div className="space-y-0.5">
            {voted.length === 0 && <p className="text-xs text-lob-muted-light italic">none yet</p>}
            {voted.map((v) => (
              <p key={v.player_id} className="text-xs text-lob-slate truncate">
                {v.player_name}
              </p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-2xs uppercase font-bold text-lob-muted tracking-wide mb-1">
            ○ Not yet ({notVoted.length})
          </p>
          <div className="space-y-0.5">
            {notVoted.length === 0 && (
              <p className="text-xs text-lob-muted-light italic">all voted!</p>
            )}
            {notVoted.map((v) => (
              <p key={v.player_id} className="text-xs text-lob-muted truncate">
                {v.player_name}
              </p>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleCard>
  )
}
