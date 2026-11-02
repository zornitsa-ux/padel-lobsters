import { useState, useMemo } from 'react'
import { Trophy, Vote } from 'lucide-react'
import { CollapsibleCard } from '../../components/ui/CollapsibleCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { groupOscarResultsByCategory, type OscarCategoryResult } from './oscarResults'
import type { ResultRow } from './oscarsSchemas'

interface ResultsViewProps {
  results: ResultRow[]
  /** Each category starts hidden and opens on tap, so the admin can reveal them one by one. */
  collapsible?: boolean
}

/* ─── Results view (used by both admin post-end and player post-share) ── */
export default function ResultsView({ results, collapsible = false }: ResultsViewProps) {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const categories = useMemo(() => groupOscarResultsByCategory(results), [results])

  if (categories.length === 0) {
    return <EmptyState icon={<Vote />} title="No votes were cast" />
  }

  return (
    <ListCard>
      {categories.map((cat) => {
        const isOpen = openIds.has(cat.id)
        return (
          <ListRow key={cat.id}>
            {collapsible ? (
              <CollapsibleCard
                className="space-y-2"
                expanded={isOpen}
                onToggle={() => toggle(cat.id)}
                header={<CategoryHeader cat={cat} hint={!isOpen} />}
              >
                <CategoryBody cat={cat} />
              </CollapsibleCard>
            ) : (
              <>
                <CategoryHeader cat={cat} hint={false} />
                <CategoryBody cat={cat} />
              </>
            )}
          </ListRow>
        )
      })}
    </ListCard>
  )
}

function CategoryHeader({ cat, hint }: { cat: OscarCategoryResult; hint: boolean }) {
  return (
    <span className="flex-1 min-w-0 flex items-center gap-2">
      <span className="text-lg">{cat.icon}</span>
      <span className="flex-1 font-bold text-sm text-lob-dark">{cat.name}</span>
      {hint && <span className="text-xs text-lob-muted-light italic">tap to reveal</span>}
    </span>
  )
}

const votesLabel = (n: number) => `${n} vote${n === 1 ? '' : 's'}`

function CategoryBody({ cat }: { cat: OscarCategoryResult }) {
  const { others } = cat
  return (
    <>
      {cat.winners.length > 0 && (
        <div>
          <p className="text-sm font-bold text-lob-dark flex items-center gap-1.5">
            <Trophy size={15} className="text-yellow-600" />
            {cat.winners.map((w) => w.target_name).join(', ')}
            {cat.winners.length > 1 && (
              <span className="text-xs font-semibold text-lob-muted ml-1">(tied)</span>
            )}
          </p>
          <p className="text-xs text-lob-muted mt-0.5">
            {votesLabel(cat.topVotes)}
            {cat.winners.length > 1 ? ' each' : ''}
          </p>
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-1 pt-0.5">
          {others.map((r, i) => (
            <div
              key={`${r.target_id}-${i}`}
              className="flex items-center gap-2 text-xs text-lob-slate"
            >
              <span className="w-5 text-center font-semibold text-lob-muted-light">
                {r.rank_in_category}
              </span>
              <span className="flex-1 truncate">{r.target_name}</span>
              <span className="text-lob-muted">{votesLabel(Number(r.votes_count))}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
