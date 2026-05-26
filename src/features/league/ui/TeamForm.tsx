import { useState, useRef, useEffect, useMemo } from 'react'
import { teamFormSchema } from '../domain/leagueSchemas'
import type { Division, GroupLabel, LeagueTeam } from '../domain/types'
import { suggestGroupForTeam } from '../domain/groupBalancer'
import { TabSwitcher } from '../../../components/ui/TabSwitcher'
import { AlertBox } from '../../../components/ui/AlertBox'
import { useCreateTeam, useUpdateTeam } from '../hooks/useLeagueMutations'

interface PlayerOption {
  id: string
  name: string
  avatar_url?: string | null
  status?: string
}

interface TeamFormProps {
  leagueId: string
  division: Division
  players: PlayerOption[]
  editTeam?: LeagueTeam | null
  /** All existing teams in this division — used to detect group formation and suggest a group */
  divisionTeams?: LeagueTeam[]
  onSuccess: () => void
  onCancel: () => void
}

const EXPERIENCE_TABS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]

interface PlayerPickerProps {
  label: string
  players: PlayerOption[]
  excludeId?: string
  selectedId?: string
  selectedName?: string
  onSelectPlayer: (id: string) => void
  onSelectPlaceholder: (name: string) => void
  error?: string
}

function PlayerPicker({
  label,
  players,
  excludeId,
  selectedId,
  selectedName,
  onSelectPlayer,
  onSelectPlaceholder,
  error,
}: PlayerPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const eligible = players.filter((p) => p.status !== 'placeholder' && p.id !== excludeId)
  const filtered = query.trim()
    ? eligible.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : eligible
  const showCreate =
    query.trim().length > 0 &&
    !eligible.some((p) => p.name.toLowerCase() === query.trim().toLowerCase())

  const displayValue = selectedId
    ? (players.find((p) => p.id === selectedId)?.name ?? '')
    : selectedName
      ? `${selectedName} (placeholder)`
      : ''

  return (
    <div className="mb-4" ref={ref}>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="input w-full"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {open && (filtered.length > 0 || showCreate) && (
          <div className="absolute z-10 w-full bg-white rounded-xl border border-gray-200 shadow-lg mt-1 max-h-48 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left"
                onMouseDown={(e) => { e.preventDefault(); onSelectPlayer(p.id); setQuery(''); setOpen(false) }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-lob-teal/10 text-lob-teal flex-shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-lob-dark">{p.name}</span>
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left border-t border-gray-100"
                onMouseDown={(e) => { e.preventDefault(); onSelectPlaceholder(query.trim()); setQuery(''); setOpen(false) }}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-lob-amber/10 text-lob-amber flex-shrink-0">
                  +
                </div>
                <span className="text-sm text-lob-dark">
                  Create placeholder: <span className="font-semibold">{query.trim()}</span>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      {displayValue && <p className="text-xs text-lob-muted mt-1">{displayValue}</p>}
      {error && <p className="text-xs text-lob-coral mt-1">{error}</p>}
    </div>
  )
}

export function TeamForm({ leagueId, division, players, editTeam, divisionTeams, onSuccess, onCancel }: TeamFormProps) {
  const isEdit = editTeam != null
  const createTeam = useCreateTeam(leagueId)
  const updateTeam = useUpdateTeam(leagueId)

  const [player1Id, setPlayer1Id] = useState<string | undefined>(editTeam?.player1_id)
  const [player1Name, setPlayer1Name] = useState<string | undefined>()
  const [player2Id, setPlayer2Id] = useState<string | undefined>(editTeam?.player2_id)
  const [player2Name, setPlayer2Name] = useState<string | undefined>()
  const [teamName, setTeamName] = useState(editTeam?.team_name ?? '')
  const [teamSong, setTeamSong] = useState(editTeam?.team_song ?? '')
  const [spiritAnimal, setSpiritAnimal] = useState(editTeam?.spirit_animal ?? '')
  const [experienceLevel, setExperienceLevel] = useState(editTeam?.experience_level ?? 'intermediate')
  const [preferredTimes, setPreferredTimes] = useState(editTeam?.preferred_play_times ?? '')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Group assignment — only shown when some teams already have group labels.
  // Exclude the team being edited so its current group doesn't skew the count.
  const teamsForGroupSuggestion = useMemo(
    () => (divisionTeams ?? []).filter((t) => !editTeam || t.id !== editTeam.id),
    [divisionTeams, editTeam],
  )
  const groupsFormed = teamsForGroupSuggestion.some((t) => t.group_label !== null)
  const suggestedGroup = useMemo(
    () => (groupsFormed ? suggestGroupForTeam(teamsForGroupSuggestion) : null),
    [groupsFormed, teamsForGroupSuggestion],
  )
  const [selectedGroup, setSelectedGroup] = useState<GroupLabel | null>(
    editTeam?.group_label ?? suggestedGroup,
  )
  // Sync suggestion on first render when divisionTeams loads after mount
  useEffect(() => {
    if (!editTeam?.group_label && suggestedGroup && selectedGroup === null) {
      setSelectedGroup(suggestedGroup)
    }
  }, [suggestedGroup, editTeam?.group_label, selectedGroup])

  // Player collision: detect if a selected player is already on another team
  const otherTeams = (divisionTeams ?? []).filter((t) => !editTeam || t.id !== editTeam.id)
  function teamNameForPlayer(playerId: string | undefined): string | null {
    if (!playerId) return null
    const match = otherTeams.find((t) => t.player1_id === playerId || t.player2_id === playerId)
    if (!match) return null
    if (match.team_name) return match.team_name
    const p1 = match.player1?.name?.split(' ')[0] ?? '?'
    const p2 = match.player2?.name?.split(' ')[0] ?? '?'
    return `${p1} & ${p2}`
  }
  const player1Conflict = teamNameForPlayer(player1Id)
  const player2Conflict = teamNameForPlayer(player2Id)

  const mutation = isEdit ? updateTeam : createTeam
  const mutationError = mutation.error as Error | null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const raw = {
      player1_id: player1Id,
      player1_name: player1Name,
      player2_id: player2Id,
      player2_name: player2Name,
      division,
      experience_level: experienceLevel,
      team_name: teamName || undefined,
      team_song: teamSong || undefined,
      spirit_animal: spiritAnimal || undefined,
      preferred_play_times: preferredTimes || undefined,
    }
    const result = teamFormSchema.safeParse(raw)
    if (!result.success) {
      const errs: Record<string, string> = {}
      result.error.issues.forEach((e) => { if (e.path[0]) errs[e.path[0] as string] = e.message })
      setValidationErrors(errs)
      return
    }
    setValidationErrors({})
    const payload: Record<string, unknown> = {
      ...result.data,
      league_id: leagueId,
      division,
      ...(groupsFormed && selectedGroup ? { group_label: selectedGroup } : {}),
    }
    if (isEdit) {
      await updateTeam.mutateAsync({ input_team_id: editTeam!.id, input_payload: payload })
    } else {
      await createTeam.mutateAsync(payload)
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PlayerPicker
        label="Player 1"
        players={players}
        excludeId={player2Id}
        selectedId={player1Id}
        selectedName={player1Name}
        onSelectPlayer={(id) => { setPlayer1Id(id); setPlayer1Name(undefined) }}
        onSelectPlaceholder={(name) => { setPlayer1Id(undefined); setPlayer1Name(name) }}
        error={validationErrors.player1_id}
      />
      {player1Conflict && (
        <AlertBox variant="warning" className="-mt-2 mb-4">
          This player is already on <strong>{player1Conflict}</strong>.
        </AlertBox>
      )}
      <PlayerPicker
        label="Player 2"
        players={players}
        excludeId={player1Id}
        selectedId={player2Id}
        selectedName={player2Name}
        onSelectPlayer={(id) => { setPlayer2Id(id); setPlayer2Name(undefined) }}
        onSelectPlaceholder={(name) => { setPlayer2Id(undefined); setPlayer2Name(name) }}
        error={validationErrors.player2_id}
      />
      {player2Conflict && (
        <AlertBox variant="warning" className="-mt-2 mb-4">
          This player is already on <strong>{player2Conflict}</strong>.
        </AlertBox>
      )}
      <div className="mb-4">
        <label className="label">Team Name</label>
        <input type="text" className="input w-full" placeholder="Optional" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
      </div>
      <div className="mb-4">
        <label className="label">Team Song</label>
        <input type="text" className="input w-full" placeholder="Optional" value={teamSong} onChange={(e) => setTeamSong(e.target.value)} />
      </div>
      <div className="mb-4">
        <label className="label">Spirit Animal</label>
        <input type="text" className="input w-full" placeholder="Optional" value={spiritAnimal} onChange={(e) => setSpiritAnimal(e.target.value)} />
        <p className="text-xs text-lob-muted mt-1">Emoji or animal name</p>
      </div>
      <div className="mb-4">
        <label className="label">Experience Level</label>
        <TabSwitcher tabs={EXPERIENCE_TABS} value={experienceLevel} onChange={(v) => setExperienceLevel(v as typeof experienceLevel)} />
      </div>
      <div className="mb-4">
        <label className="label">Preferred Play Times</label>
        <textarea className="input w-full resize-none" rows={3} placeholder="Optional" value={preferredTimes} onChange={(e) => setPreferredTimes(e.target.value)} />
        <p className="text-xs text-lob-muted mt-1">Visible to other teams for scheduling</p>
      </div>
      {groupsFormed && (
        <div className="mb-4">
          <label className="label">Assign to Group</label>
          <div className="flex gap-2 mt-1">
            {(['A', 'B'] as GroupLabel[]).map((g) => {
              const count = teamsForGroupSuggestion.filter((t) => t.group_label === g).length
              const isSuggested = g === suggestedGroup
              const isSelected = g === selectedGroup
              return (
                <button
                  key={g}
                  type="button"
                  className={[
                    'flex-1 py-2.5 rounded-xl border transition-colors text-center',
                    isSelected
                      ? 'bg-lob-teal text-white border-lob-teal'
                      : 'bg-white text-lob-dark border-gray-200 hover:border-lob-teal/50',
                  ].join(' ')}
                  onClick={() => setSelectedGroup(g)}
                >
                  <span className="block text-sm font-semibold">Group {g}</span>
                  <span className={`block text-xs font-normal mt-0.5 ${isSelected ? 'text-white/70' : 'text-lob-muted'}`}>
                    {count} team{count !== 1 ? 's' : ''}{isSuggested ? ' · suggested' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mutationError && (
        <AlertBox variant="error" className="mb-4">
          {mutationError.message ?? 'Something went wrong. Please try again.'}
        </AlertBox>
      )}
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save Team'}
        </button>
      </div>
    </form>
  )
}
