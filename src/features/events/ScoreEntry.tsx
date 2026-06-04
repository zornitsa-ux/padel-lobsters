import { useState, useEffect, useCallback } from 'react'
import type { MatchScoreUpdate } from '../../api/matches'

/* ════════════════════════════════════════════════════════════════════════════
   ScoreEntry — batched score input for a single match.

   Holds both scores in local state and writes ONE `updateMatch` only when both
   are present and something actually changed. Previously each field had its own
   onBlur/onChange that fired `updateMatch(..., completed: true)` independently,
   so a complete score was two RPCs (each followed by a full-table refetch) and
   the match was flagged `completed` after just the first number. Batching here
   halves the writes and never persists a half-entered score.

   variant:
     'input'  — two number boxes, commit on blur (Schedule grid, admin always
                sees the editable boxes)
     'select' — two dropdowns, commit on change (Scores & Ranking cards)
   ════════════════════════════════════════════════════════════════════════════ */

// Only the fields ScoreEntry reads off a (normalised) match row.
interface ScoreEntryMatch {
  id: string
  score1: number | null
  score2: number | null
  completed: boolean
}

interface ScoreEntryProps {
  match: ScoreEntryMatch
  onUpdate: (id: string, data: MatchScoreUpdate) => void | Promise<unknown>
  variant?: 'input' | 'select'
}

const MAX_SCORE = 15

const toStr = (v: number | null | undefined): string => (v == null ? '' : String(v))
const clamp = (n: number): number => Math.max(0, Math.min(MAX_SCORE, n))

export default function ScoreEntry({ match, onUpdate, variant = 'input' }: ScoreEntryProps) {
  const [s1, setS1] = useState<string>(toStr(match.score1))
  const [s2, setS2] = useState<string>(toStr(match.score2))

  // Resync local drafts when the underlying match changes from elsewhere
  // (focus refetch, schedule reload). Editing in place still works because the
  // values only change when the persisted score does.
  useEffect(() => {
    setS1(toStr(match.score1))
    setS2(toStr(match.score2))
  }, [match.score1, match.score2])

  // Commit takes explicit values so a <select> can pass the just-picked value
  // without waiting for the async state update.
  const commit = useCallback(
    (a: string, b: string) => {
      const n1 = a === '' ? null : clamp(parseInt(a, 10))
      const n2 = b === '' ? null : clamp(parseInt(b, 10))
      // Only persist a complete score…
      if (n1 == null || Number.isNaN(n1) || n2 == null || Number.isNaN(n2)) return
      // …and only if it actually changed.
      if (n1 === (match.score1 ?? null) && n2 === (match.score2 ?? null) && match.completed) return
      onUpdate(match.id, { score1: n1, score2: n2, completed: true })
    },
    [match.id, match.score1, match.score2, match.completed, onUpdate],
  )

  if (variant === 'select') {
    const onPick = (which: 1 | 2, value: string) => {
      if (which === 1) {
        setS1(value)
        commit(value, s2)
      } else {
        setS2(value)
        commit(s1, value)
      }
    }
    const selectClass =
      'w-11 h-9 text-center text-base font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal bg-white'
    return (
      <div className="flex items-center gap-1">
        <select
          aria-label="Team 1 score"
          value={s1}
          onChange={(e) => onPick(1, e.target.value)}
          className={selectClass}
        >
          <option value="">—</option>
          {Array.from({ length: MAX_SCORE + 1 }, (_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <span className="text-gray-400 font-bold text-sm">-</span>
        <select
          aria-label="Team 2 score"
          value={s2}
          onChange={(e) => onPick(2, e.target.value)}
          className={selectClass}
        >
          <option value="">—</option>
          {Array.from({ length: MAX_SCORE + 1 }, (_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const inputClass =
    'w-10 h-9 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lobster-teal'
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="0"
        max={MAX_SCORE}
        aria-label="Team 1 score"
        className={inputClass}
        value={s1}
        onChange={(e) => setS1(e.target.value)}
        onBlur={() => commit(s1, s2)}
      />
      <span className="text-gray-400">-</span>
      <input
        type="number"
        min="0"
        max={MAX_SCORE}
        aria-label="Team 2 score"
        className={inputClass}
        value={s2}
        onChange={(e) => setS2(e.target.value)}
        onBlur={() => commit(s1, s2)}
      />
    </div>
  )
}
