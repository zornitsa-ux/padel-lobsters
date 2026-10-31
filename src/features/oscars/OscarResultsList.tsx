import { ListCard, ListRow } from '../../components/ui/ListCard'
import { ProgressBar } from '../../components/ui/ProgressBar'
import type { OscarCategoryResult } from './oscarResults'

/** Each category's winners and vote bars, one row per category. */
export function OscarResultsList({
  categories,
  inset = false,
}: {
  categories: OscarCategoryResult[]
  /** Inside a card (a past event's card), not on the background. */
  inset?: boolean
}) {
  return (
    <ListCard inset={inset}>
      {categories.map((cat) => (
        <ListRow key={cat.id}>
          <p className="font-bold text-sm text-lob-slate">
            <span className="mr-1">{cat.icon}</span>
            {cat.name}
          </p>
          {cat.winners.length > 0 ? (
            <p className="text-sm text-lob-slate">
              🏆{' '}
              <span className="font-bold">{cat.winners.map((w) => w.target_name).join(', ')}</span>{' '}
              <span className="text-lob-muted-light">
                ({cat.topVotes} vote{cat.topVotes !== 1 ? 's' : ''}
                {cat.winners.length > 1 ? ' — tie' : ''})
              </span>
            </p>
          ) : (
            <p className="text-xs text-lob-muted-light">No votes</p>
          )}
          <div className="space-y-1">
            {cat.rows.map((r) => (
              <div key={r.target_id} className="flex items-center gap-2">
                <span className="text-xs w-16 truncate text-lob-slate">
                  {(r.target_name || '').split(' ')[0]}
                </span>
                <ProgressBar
                  value={(Number(r.votes_count) / cat.maxVotes) * 100}
                  size="lg"
                  className="flex-1"
                />
                <span className="text-xs text-lob-muted w-3 text-right">
                  {Number(r.votes_count)}
                </span>
              </div>
            ))}
          </div>
        </ListRow>
      ))}
    </ListCard>
  )
}
