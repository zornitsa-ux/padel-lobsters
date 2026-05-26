import { useState, useMemo } from 'react'
import { Plus, Trophy } from 'lucide-react'
import useAuth from '../../hooks/useAuth'
import { Modal } from '../../components/ui/Modal'
import { Badge } from '../../components/ui/Badge'
import { AlertBox } from '../../components/ui/AlertBox'
import { TabSwitcher } from '../../components/ui/TabSwitcher'
import { SectionHeader } from '../../components/ui/SectionHeader'
import { TeamForm } from './ui/TeamForm'
import { InvitePlayerModal } from './ui/InvitePlayerModal'
import { ScoreEntryForm } from './ui/ScoreEntryForm'
import { GroupFormationTool } from './ui/GroupFormationTool'
import { LeagueMatchCard } from './ui/LeagueMatchCard'
import {
  useActiveLeague,
  useLeagueTeams,
  useLeagueMatches,
  useAllPlayers,
} from './hooks/useLeagueQueries'
import type { PlayerOption } from './api/leagueQueries'
import {
  useCreateLeague,
  useUpdateLeagueStatus,
  useDeleteTeam,
  useCreateBracket,
} from './hooks/useLeagueMutations'
import { computeGroupStandings } from './domain/standings'
import { buildBracketPairings } from './domain/bracket'
import { resolveTeamName } from './domain/teamDisplay'
import { sortMatchesDesc } from './domain/matchDisplay'
import type {
  Division,
  GroupLabel,
  League,
  LeagueTeam,
  LeagueMatch,
  GroupStanding,
} from './domain/types'

// ─── constants ────────────────────────────────────────────────────────────────

const DIVISION_TABS = [
  { id: 'mens', label: "Men's" },
  { id: 'womens', label: "Women's" },
]

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  group_stage: 'Group Stage',
  knockout: 'Knockout',
  completed: 'Completed',
}

const STATUS_BADGE: Record<string, 'pending' | 'info' | 'gold' | 'silver'> = {
  draft: 'pending',
  group_stage: 'info',
  knockout: 'gold',
  completed: 'silver',
}

const NEXT_STATUS: Record<string, string> = {
  draft: 'group_stage',
  group_stage: 'knockout',
  knockout: 'completed',
}

// ─── LeagueCreationForm ───────────────────────────────────────────────────────

function LeagueCreationForm({
  createLeague,
}: {
  createLeague: ReturnType<typeof useCreateLeague>
}) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  async function handleCreate() {
    if (!name.trim()) return
    await createLeague.mutateAsync({ name: name.trim(), divisions: ['mens', 'womens'] })
    setName('')
    setShowForm(false)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-lob-muted">No active league. Create one to get started.</p>
      {!showForm ? (
        <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>
          Create League
        </button>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            className="input w-full"
            placeholder="League name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-secondary text-sm" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button
              className="btn-primary text-sm"
              disabled={createLeague.isPending}
              onClick={handleCreate}
            >
              {createLeague.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LeagueStatusBar ──────────────────────────────────────────────────────────

function LeagueStatusBar({
  league,
  updateStatus,
}: {
  league: League
  updateStatus: ReturnType<typeof useUpdateLeagueStatus>
}) {
  async function handleAdvanceStatus() {
    const next = NEXT_STATUS[league.status]
    if (!next) return
    if (!confirm(`Advance league to "${STATUS_LABELS[next]}"? This cannot be undone.`)) return
    await updateStatus.mutateAsync({ input_league_id: league.id, input_status: next })
  }

  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-sm font-bold text-lob-dark">{league.name}</p>
        <Badge
          variant={STATUS_BADGE[league.status] ?? 'info'}
          label={STATUS_LABELS[league.status] ?? league.status}
        />
      </div>
      {NEXT_STATUS[league.status] && (
        <button
          className="btn-secondary text-xs ml-auto"
          disabled={updateStatus.isPending}
          onClick={handleAdvanceStatus}
        >
          Advance → {STATUS_LABELS[NEXT_STATUS[league.status]]}
        </button>
      )}
    </div>
  )
}

// ─── TeamManagementSection ────────────────────────────────────────────────────

interface TeamManagementSectionProps {
  league: League
  teams: LeagueTeam[]
  division: Division
  allPlayers: PlayerOption[]
}

function TeamManagementSection({
  league,
  teams,
  division,
  allPlayers,
}: TeamManagementSectionProps) {
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [editTeam, setEditTeam] = useState<LeagueTeam | null>(null)
  const [invitePlayer, setInvitePlayer] = useState<{ id: string; name: string } | null>(null)
  const [showGroupFormation, setShowGroupFormation] = useState(false)

  const deleteTeam = useDeleteTeam(league.id)

  const divisionTeams = useMemo(
    () => teams.filter((t) => t.division === division),
    [teams, division],
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <SectionHeader icon={<Plus size={15} />} title={`Teams (${divisionTeams.length})`} />
        <button
          className="text-xs font-semibold text-lob-teal flex items-center gap-1"
          onClick={() => {
            setEditTeam(null)
            setShowTeamModal(true)
          }}
        >
          <Plus size={13} /> Add Team
        </button>
      </div>

      {divisionTeams.length === 0 ? (
        <p className="text-sm text-lob-muted">No teams in this division yet.</p>
      ) : (
        <div className="space-y-2">
          {divisionTeams.map((t) => {
            const isPlaceholder1 = t.player1?.status === 'placeholder'
            const isPlaceholder2 = t.player2?.status === 'placeholder'
            return (
              <div key={t.id} className="card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-lob-dark truncate">
                    {resolveTeamName(t)}
                  </p>
                  <p className="text-xs text-lob-muted">
                    {t.player1?.name ?? '?'}
                    {isPlaceholder1 && (
                      <button
                        className="ml-1 text-lob-amber underline"
                        onClick={() =>
                          setInvitePlayer({ id: t.player1_id, name: t.player1?.name ?? 'Player' })
                        }
                      >
                        (invite)
                      </button>
                    )}{' '}
                    &amp; {t.player2?.name ?? '?'}
                    {isPlaceholder2 && (
                      <button
                        className="ml-1 text-lob-amber underline"
                        onClick={() =>
                          setInvitePlayer({ id: t.player2_id, name: t.player2?.name ?? 'Player' })
                        }
                      >
                        (invite)
                      </button>
                    )}
                  </p>
                </div>
                <Badge
                  variant={
                    t.experience_level === 'advanced'
                      ? 'info'
                      : t.experience_level === 'intermediate'
                        ? 'gold'
                        : 'silver'
                  }
                  label={t.experience_level}
                />
                <button
                  className="text-xs text-lob-muted hover:text-lob-teal"
                  onClick={() => {
                    setEditTeam(t)
                    setShowTeamModal(true)
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-xs text-lob-muted hover:text-lob-coral"
                  onClick={async () => {
                    if (!confirm(`Remove ${resolveTeamName(t)}?`)) return
                    await deleteTeam.mutateAsync(t.id)
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}

      {league.status === 'draft' && divisionTeams.length >= 4 && (
        <button
          className="btn-secondary text-sm w-full mt-3"
          onClick={() => setShowGroupFormation(true)}
        >
          Assign Groups &amp; Generate Fixtures
        </button>
      )}

      <Modal
        open={showTeamModal}
        onClose={() => {
          setShowTeamModal(false)
          setEditTeam(null)
        }}
        title={editTeam ? 'Edit Team' : 'Add Team'}
      >
        <TeamForm
          leagueId={league.id}
          division={division}
          players={allPlayers}
          editTeam={editTeam}
          divisionTeams={divisionTeams}
          onSuccess={() => {
            setShowTeamModal(false)
            setEditTeam(null)
          }}
          onCancel={() => {
            setShowTeamModal(false)
            setEditTeam(null)
          }}
        />
      </Modal>

      {invitePlayer && (
        <InvitePlayerModal
          open={!!invitePlayer}
          onClose={() => setInvitePlayer(null)}
          playerId={invitePlayer.id}
          playerName={invitePlayer.name}
          leagueId={league.id}
        />
      )}

      <Modal
        open={showGroupFormation}
        onClose={() => setShowGroupFormation(false)}
        title="Group Formation"
      >
        <GroupFormationTool
          leagueId={league.id}
          division={division}
          teams={divisionTeams}
          onSuccess={() => setShowGroupFormation(false)}
        />
      </Modal>
    </div>
  )
}

// ─── MatchManagementSection ───────────────────────────────────────────────────

interface MatchManagementSectionProps {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
  division: Division
}

function MatchManagementSection({ league, teams, matches, division }: MatchManagementSectionProps) {
  const [scoreMatch, setScoreMatch] = useState<LeagueMatch | null>(null)

  const createBracket = useCreateBracket(league.id)

  const teamById = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])), [teams])

  const divisionTeams = useMemo(
    () => teams.filter((t) => t.division === division),
    [teams, division],
  )

  const pendingMatches = useMemo(
    () => matches.filter((m) => m.division === division && m.winner_id === null),
    [matches, division],
  )

  const completedMatches = useMemo(
    () =>
      matches
        .filter((m) => m.division === division && m.winner_id !== null)
        .sort(sortMatchesDesc),
    [matches, division],
  )

  const groupMatches = useMemo(
    () => matches.filter((m) => m.division === division && m.stage === 'group'),
    [matches, division],
  )

  const hasBracket = useMemo(
    () =>
      matches.some(
        (m) => m.division === division && (m.stage === 'gold_semi' || m.stage === 'silver_semi'),
      ),
    [matches, division],
  )

  const pendingGroupCount = groupMatches.filter((m) => m.winner_id === null).length
  const allGroupMatchesDone = groupMatches.length > 0 && pendingGroupCount === 0

  async function handleGenerateBracket(force: boolean) {
    if (!force && !allGroupMatchesDone) return
    if (
      !confirm(
        force
          ? 'Generate bracket with pending matches still outstanding?'
          : 'Generate knockout bracket?',
      )
    )
      return

    const groupATeams = divisionTeams.filter((t) => t.group_label === 'A')
    const groupBTeams = divisionTeams.filter((t) => t.group_label === 'B')

    if (groupATeams.length < 2 || groupBTeams.length < 2) {
      alert('Each group needs at least 2 teams to generate a bracket.')
      return
    }

    const divMatches = matches.filter((m) => m.division === division)
    const standingsA = computeGroupStandings(groupATeams, divMatches)
    const standingsB = computeGroupStandings(groupBTeams, divMatches)

    const pairings = buildBracketPairings(
      { A: standingsA, B: standingsB } as Record<GroupLabel, GroupStanding[]>,
      division,
    )

    await createBracket.mutateAsync({ matches: pairings })
  }

  const showGroupStage = league.status === 'group_stage' || league.status === 'knockout'

  return (
    <div className="space-y-5">
      {showGroupStage && pendingMatches.length > 0 && (
        <div>
          <SectionHeader
            icon={<Trophy size={15} />}
            title={`Pending Matches (${pendingMatches.length})`}
          />
          <div className="space-y-2">
            {pendingMatches.map((m) => (
              <LeagueMatchCard
                key={m.id}
                match={m}
                team1={teamById[m.team1_id ?? '']}
                team2={teamById[m.team2_id ?? '']}
                action={
                  <button
                    type="button"
                    className="text-xs font-semibold text-lob-teal"
                    onClick={() => setScoreMatch(m)}
                  >
                    Enter Score
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}

      {league.status === 'group_stage' && !hasBracket && groupMatches.length > 0 && (
        <div className="space-y-2">
          {allGroupMatchesDone ? (
            <AlertBox variant="success">
              All group matches reported. Ready to generate the knockout bracket.
            </AlertBox>
          ) : (
            <AlertBox variant="warning">
              {pendingGroupCount} group match{pendingGroupCount !== 1 ? 'es' : ''} still pending.
            </AlertBox>
          )}
          <div className="flex gap-2">
            {allGroupMatchesDone ? (
              <button
                className="btn-primary text-sm"
                disabled={createBracket.isPending}
                onClick={() => handleGenerateBracket(false)}
              >
                {createBracket.isPending ? 'Generating…' : 'Generate Bracket'}
              </button>
            ) : (
              <button
                className="btn-secondary text-sm"
                disabled={createBracket.isPending}
                onClick={() => handleGenerateBracket(true)}
              >
                Generate Bracket (Override)
              </button>
            )}
          </div>
          {createBracket.error && (
            <AlertBox variant="error">
              {(createBracket.error as Error).message ?? 'Failed to generate bracket.'}
            </AlertBox>
          )}
        </div>
      )}

      {league.status === 'group_stage' && hasBracket && (
        <AlertBox variant="info">Knockout bracket generated.</AlertBox>
      )}

      {showGroupStage && completedMatches.length > 0 && (
        <div>
          <SectionHeader
            icon={<Trophy size={15} />}
            title={`Results (${completedMatches.length})`}
          />
          <div className="space-y-2">
            {completedMatches.map((m) => (
              <LeagueMatchCard
                key={m.id}
                match={m}
                team1={teamById[m.team1_id ?? '']}
                team2={teamById[m.team2_id ?? '']}
                action={
                  <button
                    type="button"
                    className="text-xs font-semibold text-lob-muted hover:text-lob-teal"
                    onClick={() => setScoreMatch(m)}
                  >
                    Edit
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!scoreMatch}
        onClose={() => setScoreMatch(null)}
        title={scoreMatch?.winner_id ? 'Edit Score' : 'Enter Score'}
      >
        {scoreMatch && (
          <ScoreEntryForm
            match={scoreMatch}
            team1={teamById[scoreMatch.team1_id ?? '']}
            team2={teamById[scoreMatch.team2_id ?? '']}
            leagueId={league.id}
            onSuccess={() => setScoreMatch(null)}
            onCancel={() => setScoreMatch(null)}
          />
        )}
      </Modal>
    </div>
  )
}

// ─── LeagueAdminSection (thin container) ─────────────────────────────────────

export default function LeagueAdminSection() {
  const { session } = useAuth()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'

  const { data: league } = useActiveLeague()
  const { data: teams = [] } = useLeagueTeams(league?.id)
  const { data: matches = [] } = useLeagueMatches(league?.id)
  const { data: allPlayers = [] } = useAllPlayers()

  const createLeague = useCreateLeague()
  const updateStatus = useUpdateLeagueStatus()

  const [division, setDivision] = useState<Division>('mens')

  // All hooks are above this guard — no hook ordering violation possible.
  if (!isAdmin) {
    return <AlertBox variant="warning">Admin access required to manage leagues.</AlertBox>
  }

  return (
    <div className="space-y-5">
      <SectionHeader icon={<Trophy size={15} />} title="League Management" />

      {!league ? (
        <LeagueCreationForm createLeague={createLeague} />
      ) : (
        <div className="space-y-5">
          <LeagueStatusBar league={league} updateStatus={updateStatus} />

          <TabSwitcher
            tabs={DIVISION_TABS}
            value={division}
            onChange={(v) => setDivision(v as Division)}
          />

          <TeamManagementSection
            league={league}
            teams={teams}
            division={division}
            allPlayers={allPlayers}
          />

          <MatchManagementSection
            league={league}
            teams={teams}
            matches={matches}
            division={division}
          />
        </div>
      )}
    </div>
  )
}
