import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { AlertBox } from '../../../components/ui/AlertBox'
import { useCreateLeague } from '../hooks/useLeagueMutations'
import { createLeagueSchema } from '../domain/leagueSchemas'
import { DIVISION_LABELS } from '../domain/types'
import type { Division } from '../domain/types'

const ALL_DIVISIONS: Division[] = ['mens', 'womens']

function toggle({ list, item }: { list: Division[]; item: Division }): Division[] {
  return list.includes(item) ? list.filter((d) => d !== item) : [...list, item]
}

export function NewSeasonForm() {
  const navigate = useNavigate()
  const createLeague = useCreateLeague()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [divisions, setDivisions] = useState<Division[]>(ALL_DIVISIONS)
  const [error, setError] = useState<string | null>(null)

  function handleCreate() {
    const parsed = createLeagueSchema.safeParse({ name, divisions })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the season details')
      return
    }
    setError(null)
    createLeague.mutate(parsed.data, {
      onSuccess: (league) => {
        if (league?.id) navigate(`/league/${league.id}/manage`)
      },
    })
  }

  if (!open) {
    return (
      <button className="btn-primary text-sm flex items-center gap-1" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" /> New season
      </button>
    )
  }

  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold text-lob-dark">New season</p>
      <input
        type="text"
        className="input w-full"
        placeholder="Season name, e.g. Summer 2027"
        aria-label="Season name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <fieldset className="flex gap-4">
        <legend className="label">Divisions</legend>
        {ALL_DIVISIONS.map((d) => (
          <label key={d} className="flex items-center gap-2 text-sm text-lob-dark">
            <input
              type="checkbox"
              className="rounded"
              checked={divisions.includes(d)}
              onChange={() => setDivisions((list) => toggle({ list, item: d }))}
            />
            {DIVISION_LABELS[d]}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-lob-muted">
        New seasons start hidden from players. Publish from the season&apos;s Manage page when
        it&apos;s ready.
      </p>
      {error && <AlertBox variant="error">{error}</AlertBox>}
      <div className="flex gap-2">
        <button className="btn-secondary text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button
          className="btn-primary text-sm"
          disabled={createLeague.isPending}
          onClick={handleCreate}
        >
          {createLeague.isPending ? 'Creating…' : 'Create season'}
        </button>
      </div>
    </div>
  )
}
