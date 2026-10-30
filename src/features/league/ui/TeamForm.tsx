import { useState, useRef, useEffect, useId, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { Plus } from 'lucide-react'
import { teamFormSchema } from '../domain/leagueSchemas'
import type { Division, GroupLabel, LeagueTeam } from '../domain/types'
import { suggestGroupForTeam } from '../domain/groupBalancer'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { TabSwitcher } from '../../../components/ui/TabSwitcher'
import { AlertBox } from '../../../components/ui/AlertBox'
import Avatar from '../../../components/ui/Avatar'
import { useCreateTeam, useUpdateTeam } from '../hooks/useLeagueMutations'
import { isSelectablePlayer } from '../../players/playerSelectors'
import { ActionRow } from '../../../components/ui/ActionRow'
import { Button } from '../../../components/ui/Button'
import { MenuItem, MenuSeparator } from '../../../components/ui/MenuItem'
import { MenuList } from '../../../components/ui/MenuList'
import { focusFirstItem } from '../../../components/ui/menuFocus'
import { FormError } from '../../../components/ui/FormError'
import { useFieldError } from '../../../components/ui/useFieldError'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const { errorId, fieldProps } = useFieldError({ message: error })

  const eligible = players.filter(
    (p) => isSelectablePlayer(p) && p.status !== 'placeholder' && p.id !== excludeId,
  )
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

  const showList = open && (filtered.length > 0 || showCreate)

  // Refocusing the input runs its onFocus (open), so close after it.
  const closeToInput = () => {
    inputRef.current?.focus()
    setOpen(false)
  }

  const choose = (select: () => void) => {
    select()
    setQuery('')
    closeToInput()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showList) {
      // Stops here, so the sheet around the form stays open.
      e.stopPropagation()
      closeToInput()
    } else if (e.key === 'ArrowDown' && e.target === inputRef.current) {
      e.preventDefault()
      // Render the list now so its first item can take focus.
      flushSync(() => setOpen(true))
      focusFirstItem(listRef.current)
    }
  }

  return (
    <div
      className="space-y-1"
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <label className="label">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          className="input w-full"
          placeholder="Search by name…"
          value={query}
          aria-haspopup="menu"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          {...fieldProps}
        />
        {showList && (
          <MenuList id={listId} label={`${label} options`} listRef={listRef}>
            {filtered.map((p) => (
              <MenuItem
                key={p.id}
                icon={<Avatar player={p} size="xs" tone="bg-lob-teal/10 text-lob-teal" />}
                onSelect={() => choose(() => onSelectPlayer(p.id))}
              >
                {p.name}
              </MenuItem>
            ))}
            {showCreate && filtered.length > 0 && <MenuSeparator />}
            {showCreate && (
              <MenuItem
                icon={<Plus />}
                onSelect={() => choose(() => onSelectPlaceholder(query.trim()))}
              >
                Create placeholder: {query.trim()}
              </MenuItem>
            )}
          </MenuList>
        )}
      </div>
      {displayValue && <p className="text-xs text-lob-muted">{displayValue}</p>}
      <FormError id={errorId} message={error} />
    </div>
  )
}

export function TeamForm({
  leagueId,
  division,
  players,
  editTeam,
  divisionTeams,
  onSuccess,
  onCancel,
}: TeamFormProps) {
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
  const [experienceLevel, setExperienceLevel] = useState(
    editTeam?.experience_level ?? 'intermediate',
  )
  const [preferredTimes, setPreferredTimes] = useState(editTeam?.preferred_play_times ?? '')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const clearError = (key: string) => setValidationErrors(({ [key]: _cleared, ...rest }) => rest)

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
      result.error.issues.forEach((e) => {
        if (e.path[0]) errs[e.path[0] as string] = e.message
      })
      setValidationErrors(errs)
      return
    }
    setValidationErrors({})
    const payload = {
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
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <PlayerPicker
          label="Player 1"
          players={players}
          excludeId={player2Id}
          selectedId={player1Id}
          selectedName={player1Name}
          onSelectPlayer={(id) => {
            setPlayer1Id(id)
            setPlayer1Name(undefined)
            clearError('player1_id')
          }}
          onSelectPlaceholder={(name) => {
            setPlayer1Id(undefined)
            setPlayer1Name(name)
            clearError('player1_id')
          }}
          error={validationErrors.player1_id}
        />
        {player1Conflict && (
          <AlertBox variant="warning" size="sm">
            This player is already on <strong>{player1Conflict}</strong>.
          </AlertBox>
        )}
      </div>
      <div className="space-y-2">
        <PlayerPicker
          label="Player 2"
          players={players}
          excludeId={player1Id}
          selectedId={player2Id}
          selectedName={player2Name}
          onSelectPlayer={(id) => {
            setPlayer2Id(id)
            setPlayer2Name(undefined)
            clearError('player2_id')
          }}
          onSelectPlaceholder={(name) => {
            setPlayer2Id(undefined)
            setPlayer2Name(name)
            clearError('player2_id')
          }}
          error={validationErrors.player2_id}
        />
        {player2Conflict && (
          <AlertBox variant="warning" size="sm">
            This player is already on <strong>{player2Conflict}</strong>.
          </AlertBox>
        )}
      </div>
      <div>
        <label className="label">Team Name</label>
        <input
          type="text"
          className="input w-full"
          placeholder="Optional"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Team Song</label>
        <input
          type="text"
          className="input w-full"
          placeholder="Optional"
          value={teamSong}
          onChange={(e) => setTeamSong(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Spirit Animal</label>
        <input
          type="text"
          className="input w-full"
          placeholder="Optional"
          value={spiritAnimal}
          onChange={(e) => setSpiritAnimal(e.target.value)}
        />
        <p className="text-xs text-lob-muted mt-1">Emoji or animal name</p>
      </div>
      <div>
        <label className="label">Experience Level</label>
        <TabSwitcher
          tabs={EXPERIENCE_TABS}
          value={experienceLevel}
          onChange={(v) => setExperienceLevel(v as typeof experienceLevel)}
        />
      </div>
      <div>
        <label className="label">Preferred Play Times</label>
        <textarea
          className="input w-full resize-none"
          rows={3}
          placeholder="Optional"
          value={preferredTimes}
          onChange={(e) => setPreferredTimes(e.target.value)}
        />
        <p className="text-xs text-lob-muted mt-1">Visible to other teams for scheduling</p>
      </div>
      {groupsFormed && (
        <div>
          <label className="label">Assign to Group</label>
          <SegmentedControl
            ariaLabel="Group"
            options={(['A', 'B'] as GroupLabel[]).map((g) => {
              const count = teamsForGroupSuggestion.filter((t) => t.group_label === g).length
              return {
                value: g,
                label: `Group ${g}`,
                detail: `${count} team${count !== 1 ? 's' : ''}${g === suggestedGroup ? ' · suggested' : ''}`,
              }
            })}
            value={selectedGroup}
            onChange={setSelectedGroup}
          />
        </div>
      )}

      {mutationError && (
        <AlertBox variant="error">
          {mutationError.message ?? 'Something went wrong. Please try again.'}
        </AlertBox>
      )}
      <div className="pt-2">
        <ActionRow>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save Team'}
          </Button>
        </ActionRow>
      </div>
    </form>
  )
}
