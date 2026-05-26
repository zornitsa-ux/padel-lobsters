import { useState } from 'react'
import { AlertBox } from '../../../components/ui/AlertBox'
import type { LeagueMatch, LeagueTeam } from '../domain/types'
import { useRecordResult } from '../hooks/useLeagueMutations'

interface ScoreEntryFormProps {
  match: LeagueMatch
  team1: LeagueTeam | undefined
  team2: LeagueTeam | undefined
  leagueId: string
  onSuccess: () => void
  onCancel: () => void
}

function teamLabel(team: LeagueTeam | undefined): string {
  if (!team) return '—'
  if (team.team_name) return team.team_name
  const p1 = team.player1?.name?.split(' ')[0] ?? '?'
  const p2 = team.player2?.name?.split(' ')[0] ?? '?'
  return `${p1} & ${p2}`
}

interface SetInputProps {
  label: string
  t1: string
  t2: string
  onT1: (v: string) => void
  onT2: (v: string) => void
  team1Label: string
  team2Label: string
  error?: string
}

function SetInput({ label, t1, t2, onT1, onT2, team1Label, team2Label, error }: SetInputProps) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-lob-muted mb-1">{label}</p>
      <div className="flex items-center gap-3">
        <span className="text-sm text-lob-dark truncate max-w-[80px]">{team1Label}</span>
        <input
          type="number"
          min="0"
          max="99"
          value={t1}
          onChange={(e) => onT1(e.target.value)}
          className="input w-16 text-center text-lg font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-sm text-gray-400">vs</span>
        <input
          type="number"
          min="0"
          max="99"
          value={t2}
          onChange={(e) => onT2(e.target.value)}
          className="input w-16 text-center text-lg font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-sm text-lob-dark truncate max-w-[80px]">{team2Label}</span>
      </div>
      {error && <p className="text-xs text-lob-coral mt-1">{error}</p>}
    </div>
  )
}

function setStr(n: number | undefined) { return n != null ? String(n) : '' }

export function ScoreEntryForm({ match, team1, team2, leagueId, onSuccess, onCancel }: ScoreEntryFormProps) {
  const existing = match.set_scores
  const [s1t1, setS1t1] = useState(setStr(existing?.[0]?.t1))
  const [s1t2, setS1t2] = useState(setStr(existing?.[0]?.t2))
  const [s2t1, setS2t1] = useState(setStr(existing?.[1]?.t1))
  const [s2t2, setS2t2] = useState(setStr(existing?.[1]?.t2))
  const [superTb, setSuperTb] = useState(existing != null && existing.length === 3)
  const [s3t1, setS3t1] = useState(setStr(existing?.[2]?.t1))
  const [s3t2, setS3t2] = useState(setStr(existing?.[2]?.t2))
  const [playedOn, setPlayedOn] = useState(match.played_on ?? new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState(match.location ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const recordResult = useRecordResult(leagueId)
  const t1Label = teamLabel(team1)
  const t2Label = teamLabel(team2)

  function countWins() {
    let w1 = 0, w2 = 0
    const sets = [[s1t1, s1t2], [s2t1, s2t2], ...(superTb ? [[s3t1, s3t2]] : [])]
    for (const [a, b] of sets) {
      const an = Number(a), bn = Number(b)
      if (a !== '' && b !== '' && an !== bn) {
        if (an > bn) w1++; else w2++
      }
    }
    return [w1, w2]
  }

  function winnerPreview() {
    const [w1, w2] = countWins()
    const hasScore = s1t1 !== '' || s2t1 !== ''
    if (!hasScore || w1 === w2) return null
    const name = w1 > w2 ? t1Label : t2Label
    return `${name} wins ${Math.max(w1, w2)}–${Math.min(w1, w2)}`
  }

  function validate() {
    const errs: Record<string, string> = {}
    const s1a = Number(s1t1), s1b = Number(s1t2)
    const s2a = Number(s2t1), s2b = Number(s2t2)
    if (s1t1 === '' || s1t2 === '') errs.set1 = 'Enter Set 1 scores'
    else if (s1a === s1b) errs.set1 = 'Set 1 cannot be tied'
    if (s2t1 === '' || s2t2 === '') errs.set2 = 'Enter Set 2 scores'
    else if (s2a === s2b) errs.set2 = 'Set 2 cannot be tied'
    if (superTb) {
      const s3a = Number(s3t1), s3b = Number(s3t2)
      if (s3t1 === '' || s3t2 === '') errs.set3 = 'Enter super tiebreak scores'
      else if (Math.max(s3a, s3b) < 10) errs.set3 = 'Super tiebreak must reach 10 points'
      else if (Math.abs(s3a - s3b) < 2) errs.set3 = 'Super tiebreak must be decided by 2 points'
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    const sets = [
      { t1: Number(s1t1), t2: Number(s1t2) },
      { t1: Number(s2t1), t2: Number(s2t2) },
      ...(superTb ? [{ t1: Number(s3t1), t2: Number(s3t2) }] : []),
    ]
    try {
      await recordResult.mutateAsync({
        match_id: match.id,
        sets,
        played_on: playedOn,
        location: location || undefined,
      } as Record<string, unknown>)
      onSuccess()
    } catch {
      // error is surfaced via recordResult.error
    }
  }

  const preview = winnerPreview()

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-1">
      <SetInput label="Set 1" t1={s1t1} t2={s1t2} onT1={setS1t1} onT2={setS1t2} team1Label={t1Label} team2Label={t2Label} error={errors.set1} />
      <SetInput label="Set 2" t1={s2t1} t2={s2t2} onT1={setS2t1} onT2={setS2t2} team1Label={t1Label} team2Label={t2Label} error={errors.set2} />

      <div className="flex items-center gap-2 py-2">
        <input
          id="super-tb"
          type="checkbox"
          checked={superTb}
          onChange={(e) => { setSuperTb(e.target.checked); if (!e.target.checked) { setS3t1(''); setS3t2('') } }}
          className="rounded"
        />
        <label htmlFor="super-tb" className="text-sm text-lob-dark">Super tiebreak</label>
      </div>

      {superTb && (
        <SetInput label="Set 3 (Super tiebreak)" t1={s3t1} t2={s3t2} onT1={setS3t1} onT2={setS3t2} team1Label={t1Label} team2Label={t2Label} error={errors.set3} />
      )}

      {preview && (
        <p className="text-sm font-semibold text-lob-teal py-1">{preview}</p>
      )}

      <div className="pt-2">
        <label className="label">Date played</label>
        <input type="date" className="input w-full" value={playedOn} onChange={(e) => setPlayedOn(e.target.value)} />
      </div>

      <div>
        <label className="label">Location</label>
        <input type="text" className="input w-full" placeholder="Optional" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      {recordResult.error && (
        <AlertBox variant="error" className="mt-2">
          {(recordResult.error as Error).message ?? 'Failed to save result. Please try again.'}
        </AlertBox>
      )}

      <div className="flex gap-3 pt-4">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary flex-1" disabled={recordResult.isPending}>
          {recordResult.isPending ? 'Saving…' : 'Save Result'}
        </button>
      </div>
    </form>
  )
}
