import { useState, useEffect, useCallback, useRef } from 'react'
import type { MatchScoreUpdate } from './matchQueries'

/* ════════════════════════════════════════════════════════════════════════════
   ScoreEntry — batched score input for a single match.

   Holds both scores in local state and writes ONE `updateMatch` only when both
   are present and something actually changed. Previously each field had its own
   onBlur/onChange that fired `updateMatch(..., completed: true)` independently,
   so a complete score was two RPCs (each followed by a full-table refetch) and
   the match was flagged `completed` after just the first number. Batching here
   halves the writes and never persists a half-entered score.

   Several admins enter scores at once during an event, so an incoming peer
   update must never overwrite a half-typed draft: while the draft is dirty the
   peer's value is parked as `conflict` and offered for the admin to accept,
   rather than silently replacing what they typed.

   variant:
     'input'  — two number boxes, commit on blur (Schedule grid, admin always
                sees the editable boxes)
     'select' — two dropdowns, commit on change (Scores & Ranking cards)
   ════════════════════════════════════════════════════════════════════════════ */

// Only the fields ScoreEntry reads off a (normalised) match row.
interface ScoreEntryMatch {
  id: string
  score1?: number | null
  score2?: number | null
  // Nullable in the `matches` table (column default false, no NOT NULL).
  completed?: boolean | null
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
  // A peer's score that arrived mid-edit, parked instead of applied.
  const [conflict, setConflict] = useState<{ s1: string; s2: string } | null>(null)

  // Latest drafts, readable from the resync effect without widening its deps
  // (which would re-run it on every keystroke and defeat the dirty check).
  const draftRef = useRef({ s1, s2 })
  draftRef.current = { s1, s2 }
  // True once the admin has typed something that hasn't been persisted yet.
  const dirtyRef = useRef(false)

  const applyExternal = useCallback((next1: string, next2: string) => {
    dirtyRef.current = false
    setConflict(null)
    setS1(next1)
    setS2(next2)
  }, [])

  // Resync when the persisted score changes from elsewhere: a peer's broadcast,
  // a focus refetch, or our own write echoing back. Never clobbers a dirty
  // draft — that's what parks the value as a conflict for the admin to accept.
  useEffect(() => {
    const next1 = toStr(match.score1)
    const next2 = toStr(match.score2)
    const { s1: draft1, s2: draft2 } = draftRef.current
    // Already what we're showing (typically our own write echoing back).
    if (next1 === draft1 && next2 === draft2) {
      dirtyRef.current = false
      setConflict(null)
      return
    }
    if (dirtyRef.current) {
      setConflict({ s1: next1, s2: next2 })
      return
    }
    applyExternal(next1, next2)
  }, [match.score1, match.score2, applyExternal])

  // Commit takes explicit values so a <select> can pass the just-picked value
  // without waiting for the async state update.
  const commit = useCallback(
    (a: string, b: string) => {
      const n1 = a === '' ? null : clamp(parseInt(a, 10))
      const n2 = b === '' ? null : clamp(parseInt(b, 10))
      // Only persist a complete score…
      if (n1 == null || Number.isNaN(n1) || n2 == null || Number.isNaN(n2)) return
      // A complete score settles this admin's intent, so the draft stops being
      // dirty and any parked peer value is resolved — before the changed check,
      // not after. Typing the same score a peer just wrote takes the early
      // return below, and clearing there would leave the cell dirty forever:
      // the resync effect can't re-run (the persisted score never changed), so
      // every later peer update would park as a conflict instead of applying.
      dirtyRef.current = false
      setConflict(null)
      // …and only write if it actually changed.
      if (n1 === (match.score1 ?? null) && n2 === (match.score2 ?? null) && match.completed) return
      onUpdate(match.id, { score1: n1, score2: n2, completed: true })
    },
    [match.id, match.score1, match.score2, match.completed, onUpdate],
  )

  const markDirty = useCallback(() => {
    dirtyRef.current = true
  }, [])

  // Rendered under both variants when a peer's score landed mid-edit. Capped
  // and wrapping because the Schedule grid's score column is ~90px wide between
  // two team columns — a wider pill would shove them around.
  const conflictNotice = conflict && (
    <button
      type="button"
      onClick={() => applyExternal(conflict.s1, conflict.s2)}
      aria-live="polite"
      className="mt-1 w-full max-w-[96px] self-center text-[10px] leading-tight font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-1 py-0.5"
    >
      Another admin: {conflict.s1 || '—'}–{conflict.s2 || '—'} · tap to use
    </button>
  )

  if (variant === 'select') {
    const onPick = (which: 1 | 2, value: string) => {
      // A half-picked pair stays dirty until commit() persists both sides.
      markDirty()
      if (which === 1) {
        setS1(value)
        commit(value, s2)
      } else {
        setS2(value)
        commit(s1, value)
      }
    }
    const selectClass =
      'w-11 h-9 text-center text-base font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lob-teal bg-white'
    const options = [
      <option key="blank" value="">
        —
      </option>,
      ...Array.from({ length: MAX_SCORE + 1 }, (_, i) => (
        <option key={i} value={i}>
          {i}
        </option>
      )),
    ]
    return (
      <div className="flex flex-col items-stretch">
        <div className="flex items-center gap-1">
          <select
            aria-label="Team 1 score"
            value={s1}
            onChange={(e) => onPick(1, e.target.value)}
            className={selectClass}
          >
            {options}
          </select>
          <span className="text-lob-muted-light font-bold text-sm">-</span>
          <select
            aria-label="Team 2 score"
            value={s2}
            onChange={(e) => onPick(2, e.target.value)}
            className={selectClass}
          >
            {options}
          </select>
        </div>
        {conflictNotice}
      </div>
    )
  }

  const inputClass =
    'w-10 h-9 text-center text-lg font-bold border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-lob-teal'
  const onType = (setter: (value: string) => void) => (value: string) => {
    markDirty()
    setter(value)
  }
  return (
    <div className="flex flex-col items-stretch">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          max={MAX_SCORE}
          aria-label="Team 1 score"
          className={inputClass}
          value={s1}
          onChange={(e) => onType(setS1)(e.target.value)}
          onBlur={() => commit(s1, s2)}
        />
        <span className="text-lob-muted-light">-</span>
        <input
          type="number"
          min="0"
          max={MAX_SCORE}
          aria-label="Team 2 score"
          className={inputClass}
          value={s2}
          onChange={(e) => onType(setS2)(e.target.value)}
          onBlur={() => commit(s1, s2)}
        />
      </div>
      {conflictNotice}
    </div>
  )
}
