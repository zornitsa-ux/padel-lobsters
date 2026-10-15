import { useMemo } from 'react'
import { GENDER_UNEVEN_AVOIDABLE_FLAG, PROVISIONAL_LEVEL_SIGMA } from '../domain/report'
import { pairKey } from '../domain/scheduleOps'
import type { ScheduleRun } from '../domain/types'
import { courtChip, hasBothGenders } from './genderCopy'
import { CourtGenderChip, GenderLegendEntries, GenderMark } from './genderMarks'

type RoundReport = ScheduleRun['rounds'][number]
type CourtReport = RoundReport['courts'][number]
type PlayerInput = CourtReport['players'][number]

const isProvisional = (player: PlayerInput): boolean => player.sigma >= PROVISIONAL_LEVEL_SIGMA

function playerMap(players: PlayerInput[]): Record<string, PlayerInput> {
  const map: Record<string, PlayerInput> = {}
  for (const player of players) map[player.playerId] = player
  return map
}

/**
 * Named opposing pairs meeting again on a court, derived from persisted team
 * composition rather than the opaque 'opponent-rematch' court flag (D-024
 * pattern: move the signal onto the specific players it's about). Works
 * identically for historical schedule_runs rows, since `teams` has always
 * been persisted per court.
 */
function rematchesByCourt(rounds: ScheduleRun['rounds']): [string, string][][][] {
  const meetings = new Map<string, number>()
  return rounds.map((round) =>
    round.courts.map((court) => {
      const [team1, team2] = court.teams
      const pairs: [string, string][] = []
      for (const a of team1) {
        for (const b of team2) {
          const key = pairKey(a, b)
          const count = (meetings.get(key) ?? 0) + 1
          meetings.set(key, count)
          if (count >= 2) pairs.push([a, b])
        }
      }
      return pairs
    }),
  )
}

function TeamNames({
  ids,
  players,
  showGender,
  onPickPlayer,
}: {
  ids: [string, string]
  players: Record<string, PlayerInput>
  showGender: boolean
  onPickPlayer?: (playerId: string) => void
}) {
  return (
    <div className="space-y-0.5">
      {ids.map((id) => {
        const player = players[id]
        return (
          <div
            key={id}
            className="flex items-center gap-1 text-sm font-medium text-lob-slate truncate"
          >
            {onPickPlayer ? (
              <button
                type="button"
                onClick={() => onPickPlayer(id)}
                aria-label={`Swap options for ${player?.name ?? id}`}
                className="min-w-0 truncate min-h-[40px] text-left font-medium hover:underline decoration-dotted underline-offset-2"
              >
                {player?.name ?? id}
              </button>
            ) : (
              <span className="min-w-0 truncate">{player?.name ?? id}</span>
            )}
            <span className="flex shrink-0 items-center gap-1">
              {showGender && player && <GenderMark gender={player.gender} />}
              {player?.isLeftHanded && <span title="Left-handed">🤚</span>}
              {player && isProvisional(player) && <span title="Level still being learned">📏</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export type OnFixRematch = (args: { roundIndex: number; pair: [string, string] }) => void
export type OnFixUnevenCourt = (args: { roundIndex: number; courtIndex: number }) => void
export type OnPickPlayer = (args: { roundIndex: number; playerId: string }) => void

export type SwapHandlers = {
  onFixRematch?: OnFixRematch
  onFixUnevenCourt?: OnFixUnevenCourt
  onPickPlayer?: OnPickPlayer
}

function CourtCard({
  court,
  index,
  rematches,
  roundIndex,
  onFixRematch,
  onFixUnevenCourt,
  onPickPlayer,
  showGender,
}: SwapHandlers & {
  court: CourtReport
  index: number
  rematches: [string, string][]
  roundIndex: number
  showGender: boolean
}) {
  const pickPlayer = onPickPlayer && ((playerId: string) => onPickPlayer({ roundIndex, playerId }))
  const canEvenOut = onFixUnevenCourt && court.flags.includes(GENDER_UNEVEN_AVOIDABLE_FLAG)
  const players = playerMap(court.players)
  const [team1, team2] = court.teams
  const [sum1, sum2] = court.teamSums

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full">
            Court {index + 1}
          </span>
          {showGender && (
            <CourtGenderChip
              chip={courtChip({ teams: court.teams, players: court.players, flags: court.flags })}
              onFix={
                canEvenOut ? () => onFixUnevenCourt({ roundIndex, courtIndex: index }) : undefined
              }
              fixLabel={`Even out Court ${index + 1}`}
            />
          )}
        </div>
        <span className="text-xs text-lob-muted-light">Spread {court.courtSpread.toFixed(2)}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <TeamNames
            ids={team1}
            players={players}
            showGender={showGender}
            onPickPlayer={pickPlayer}
          />
          <p className="text-xs text-lob-muted-light mt-0.5">{sum1.toFixed(1)}</p>
        </div>
        <span className="text-xs text-lob-muted-light font-medium flex-shrink-0">vs</span>
        <div className="flex-1 min-w-0 text-right">
          <TeamNames
            ids={team2}
            players={players}
            showGender={showGender}
            onPickPlayer={pickPlayer}
          />
          <p className="text-xs text-lob-muted-light mt-0.5">{sum2.toFixed(1)}</p>
        </div>
      </div>

      {rematches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rematches.map(([a, b]) => (
            <span
              key={pairKey(a, b)}
              className={
                onFixRematch
                  ? 'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700'
                  : 'text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700'
              }
            >
              {players[a]?.name ?? a} vs {players[b]?.name ?? b} — repeat
              {onFixRematch && (
                <button
                  type="button"
                  onClick={() => onFixRematch({ roundIndex, pair: [a, b] })}
                  className="underline decoration-dotted underline-offset-2 hover:text-amber-900"
                >
                  Fix
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RoundSection({
  round,
  index,
  rematches,
  showGender,
  ...handlers
}: SwapHandlers & {
  round: RoundReport
  index: number
  rematches: [string, string][][]
  showGender: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-lob-slate text-sm">Round {index + 1}</p>
      <div className="space-y-2">
        {round.courts.map((court, courtIndex) => (
          <CourtCard
            key={courtIndex}
            court={court}
            index={courtIndex}
            rematches={rematches[courtIndex]}
            roundIndex={index}
            showGender={showGender}
            {...handlers}
          />
        ))}
      </div>
      {round.sitters.length > 0 && (
        <p className="text-xs text-lob-muted">
          Sitting out: {round.sitters.map((sitter) => sitter.name).join(', ')}
        </p>
      )}
    </div>
  )
}

// Only list markers that actually appear, so the key stays honest to the schedule.
function Legend({ rounds, showGender }: { rounds: ScheduleRun['rounds']; showGender: boolean }) {
  const courtPlayers = rounds.flatMap((round) => round.courts.flatMap((court) => court.players))
  const hasLefty = courtPlayers.some((player) => player.isLeftHanded)
  const hasProvisional = courtPlayers.some(isProvisional)

  if (!hasLefty && !hasProvisional && !showGender) return null

  return (
    <div className="flex flex-col gap-x-4 gap-y-1 text-xs text-lob-muted">
      <span className="font-medium text-lob-muted-light">Key:</span>
      {showGender && <GenderLegendEntries />}
      {hasLefty && (
        <span className="flex items-center gap-1">
          <span aria-hidden>🤚</span> Left-handed
        </span>
      )}
      {hasProvisional && (
        <span className="flex items-center gap-1">
          <span aria-hidden>📏</span> Level still being learned — balance is less certain
        </span>
      )}
    </div>
  )
}

export default function ScheduleRounds({
  rounds,
  ...handlers
}: SwapHandlers & {
  rounds: ScheduleRun['rounds']
}) {
  const rematches = useMemo(() => rematchesByCourt(rounds), [rounds])
  const showGender = useMemo(
    () => hasBothGenders(rounds.flatMap((round) => round.courts.flatMap((court) => court.players))),
    [rounds],
  )
  return (
    <div className="space-y-4">
      <Legend rounds={rounds} showGender={showGender} />
      {rounds.map((round, index) => (
        <RoundSection
          key={index}
          round={round}
          index={index}
          rematches={rematches[index]}
          showGender={showGender}
          {...handlers}
        />
      ))}
    </div>
  )
}
