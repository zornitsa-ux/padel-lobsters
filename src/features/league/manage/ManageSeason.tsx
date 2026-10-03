import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { AlertBox } from '../../../components/ui/AlertBox'
import { useConfirm } from '../../../lib/confirmBus'
import {
  useDeleteLeague,
  useSetLeaguePublished,
  useUpdateLeague,
} from '../hooks/useLeagueMutations'
import { isPublished } from '../domain/lifecycle'
import { DIVISION_LABELS, leagueDivisions } from '../domain/types'
import type { Division, League, LeagueMatch, LeagueTeam } from '../domain/types'

const ALL_DIVISIONS: Division[] = ['mens', 'womens']

function errorText(error: unknown): string | null {
  return error ? ((error as Error).message ?? 'Something went wrong.') : null
}

function VisibilityCard({ league }: { league: League }) {
  const confirm = useConfirm()
  const setPublished = useSetLeaguePublished(league.id)
  const published = isPublished(league)
  const canHide = league.status === 'draft'

  async function handlePublish() {
    const ok = await confirm({
      message: `Publish ${league.name}? Players will be able to see it and its teams.`,
    })
    if (ok) setPublished.mutate(true)
  }

  return (
    <div className="card space-y-2">
      <div className="flex items-center gap-2">
        {published ? (
          <Eye size={16} className="text-lob-teal" aria-hidden="true" />
        ) : (
          <EyeOff size={16} className="text-lob-muted" aria-hidden="true" />
        )}
        <p className="text-sm font-semibold text-lob-dark">
          {published ? 'Visible to players' : 'Hidden from players'}
        </p>
      </div>
      {published ? (
        canHide && (
          <button
            className="btn-secondary text-sm"
            disabled={setPublished.isPending}
            onClick={() => setPublished.mutate(false)}
          >
            Hide again
          </button>
        )
      ) : (
        <>
          <p className="text-xs text-lob-muted">
            Only admins can see this season. Publish it when the teams are ready to be announced.
          </p>
          <button
            className="btn-primary text-sm"
            disabled={setPublished.isPending}
            onClick={handlePublish}
          >
            Publish season
          </button>
        </>
      )}
      {setPublished.error && <AlertBox variant="error">{errorText(setPublished.error)}</AlertBox>}
    </div>
  )
}

function DetailsCard({ league, teams }: { league: League; teams: LeagueTeam[] }) {
  const updateLeague = useUpdateLeague(league.id)
  const [name, setName] = useState(league.name)
  const [divisions, setDivisions] = useState<Division[]>(leagueDivisions(league))
  const isDraft = league.status === 'draft'
  const hasTeams = (d: Division) => teams.some((t) => t.division === d)

  function toggle(d: Division) {
    setDivisions((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]))
  }

  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold text-lob-dark">Details</p>
      <div>
        <label className="label" htmlFor="season-name">
          Season name
        </label>
        <input
          id="season-name"
          type="text"
          className="input w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <fieldset className="space-y-1">
        <legend className="label">Divisions</legend>
        <div className="flex gap-4">
          {ALL_DIVISIONS.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-lob-dark">
              <input
                type="checkbox"
                className="rounded"
                checked={divisions.includes(d)}
                disabled={!isDraft || (divisions.includes(d) && hasTeams(d))}
                onChange={() => toggle(d)}
              />
              {DIVISION_LABELS[d]}
            </label>
          ))}
        </div>
        <p className="text-xs text-lob-muted">
          {isDraft
            ? 'A division with teams can’t be removed.'
            : 'Divisions are fixed once the group stage starts.'}
        </p>
      </fieldset>
      {updateLeague.error && <AlertBox variant="error">{errorText(updateLeague.error)}</AlertBox>}
      <button
        className="btn-secondary text-sm"
        disabled={updateLeague.isPending || !name.trim() || divisions.length === 0}
        onClick={() =>
          updateLeague.mutate(isDraft ? { name: name.trim(), divisions } : { name: name.trim() })
        }
      >
        {updateLeague.isPending ? 'Saving…' : 'Save details'}
      </button>
    </div>
  )
}

function DeleteCard({ league, matches }: { league: League; matches: LeagueMatch[] }) {
  const confirm = useConfirm()
  const navigate = useNavigate()
  const deleteLeague = useDeleteLeague(league.id)
  if (league.status !== 'draft' || matches.length > 0) return null

  async function handleDelete() {
    const ok = await confirm({
      message: `Delete ${league.name} and its teams? This cannot be undone.`,
      destructive: true,
    })
    if (!ok) return
    deleteLeague.mutate(undefined, {
      onSuccess: () => navigate('/league/seasons', { replace: true }),
    })
  }

  return (
    <div className="card space-y-2">
      <p className="text-sm font-semibold text-lob-dark">Delete season</p>
      <p className="text-xs text-lob-muted">
        Available until fixtures are generated. Teams in this season are deleted with it.
      </p>
      {deleteLeague.error && <AlertBox variant="error">{errorText(deleteLeague.error)}</AlertBox>}
      <button
        className="btn-secondary text-sm text-lob-coral"
        disabled={deleteLeague.isPending}
        onClick={handleDelete}
      >
        Delete season
      </button>
    </div>
  )
}

interface ManageSeasonProps {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
}

export function ManageSeason({ league, teams, matches }: ManageSeasonProps) {
  return (
    <div className="space-y-4">
      <VisibilityCard league={league} />
      <DetailsCard league={league} teams={teams} />
      <DeleteCard league={league} matches={matches} />
    </div>
  )
}
