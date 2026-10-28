import { Check } from 'lucide-react'
import { OptionTile } from '../../components/ui/OptionTile'
import type { CategoryRow } from './oscarsSchemas'
import type { OscarVote } from './useOscarsSession'

interface CategoryGridProps {
  categories: CategoryRow[]
  myVoteByCat: Record<string, OscarVote>
  /** null renders the grid read-only (the post-voting recap). */
  onSelect: ((categoryId: string) => void) | null
  showWaitingState?: boolean
}

/* ─── Player: home tile grid ──────────────────────────────────────────── */
export default function CategoryGrid({
  categories,
  myVoteByCat,
  onSelect,
  showWaitingState = false,
}: CategoryGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {categories.map((c) => {
        const voted = myVoteByCat[c.id]
        return (
          <OptionTile
            key={c.id}
            muted={!!voted}
            onClick={onSelect ? () => onSelect(c.id) : undefined}
          >
            <span className="min-h-[88px] flex flex-col justify-between">
              <span className="text-2xl">{c.icon}</span>
              <span>
                <span className="block font-bold text-sm leading-tight text-lob-dark">
                  {c.name}
                </span>
                {voted ? (
                  <span className="text-xs text-lob-success font-semibold mt-1 flex items-center gap-1">
                    <Check size={11} /> Voted: {voted.name}
                    {onSelect && (
                      <span className="text-lob-muted-light font-normal ml-0.5">
                        · tap to change
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="block text-xs text-lob-muted-light mt-1">
                    {showWaitingState ? "You didn't vote" : 'Tap to vote'}
                  </span>
                )}
              </span>
            </span>
          </OptionTile>
        )
      })}
    </div>
  )
}
