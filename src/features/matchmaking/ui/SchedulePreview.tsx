import { Shuffle, Columns2, X } from 'lucide-react'
import type { ScheduleRun } from '../domain/types'
import QualityReport from './QualityReport'

type RoundReport = ScheduleRun['rounds'][number]
type CourtReport = RoundReport['courts'][number]
type PlayerInput = CourtReport['players'][number]

export type SchedulePreviewProps = {
  run: ScheduleRun // the current preview
  compareRun?: ScheduleRun | null // an alternate for side-by-side; when set, show the compare panel
  onReshuffle: () => void // re-seed → replaces the preview
  onCompare: () => void // generate one alternate → sets compareRun
  onPickRun: (which: 'current' | 'compare') => void // resolve compare → winner becomes preview
  onCancelCompare: () => void
  onSave: () => void
  reshuffling: boolean
  comparing: boolean
  saving: boolean
}

function playerMap(players: PlayerInput[]): Record<string, PlayerInput> {
  const map: Record<string, PlayerInput> = {}
  for (const player of players) map[player.playerId] = player
  return map
}

function TeamNames({ ids, players }: { ids: [string, string]; players: Record<string, PlayerInput> }) {
  return (
    <div className="space-y-0.5">
      {ids.map((id) => {
        const player = players[id]
        return (
          <div key={id} className="flex items-center gap-1 text-sm font-medium text-gray-700 truncate">
            <span className="truncate">{player?.name ?? id}</span>
            {player?.isLeftHanded && <span title="Left-handed">🤚</span>}
          </div>
        )
      })}
    </div>
  )
}

function CourtCard({ court, index }: { court: CourtReport; index: number }) {
  const players = playerMap(court.players)
  const [team1, team2] = court.teams
  const [sum1, sum2] = court.teamSums

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-lob-teal bg-lob-cream px-2 py-0.5 rounded-full">
          Court {index + 1}
        </span>
        <span className="text-xs text-gray-400">Spread {court.courtSpread.toFixed(2)}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <TeamNames ids={team1} players={players} />
          <p className="text-xs text-gray-400 mt-0.5">{sum1.toFixed(1)}</p>
        </div>
        <span className="text-xs text-gray-400 font-medium flex-shrink-0">vs</span>
        <div className="flex-1 text-right">
          <TeamNames ids={team2} players={players} />
          <p className="text-xs text-gray-400 mt-0.5">{sum2.toFixed(1)}</p>
        </div>
      </div>

      {court.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {court.flags.map((flag) => (
            <span
              key={flag}
              className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700"
            >
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RoundSection({ round, index }: { round: RoundReport; index: number }) {
  return (
    <div className="space-y-2">
      <p className="font-semibold text-gray-700 text-sm">Round {index + 1}</p>
      <div className="space-y-2">
        {round.courts.map((court, courtIndex) => (
          <CourtCard key={courtIndex} court={court} index={courtIndex} />
        ))}
      </div>
      {round.sitters.length > 0 && (
        <p className="text-xs text-gray-500">
          Sitting out: {round.sitters.map((sitter) => sitter.name).join(', ')}
        </p>
      )}
    </div>
  )
}

function RunLabel({ run }: { run: ScheduleRun }) {
  return (
    <p className="label">
      {run.config.preset} · seed {run.seed}
    </p>
  )
}

function ComparePanel({
  run,
  compareRun,
  onPickRun,
  onCancelCompare,
}: {
  run: ScheduleRun
  compareRun: ScheduleRun
  onPickRun: (which: 'current' | 'compare') => void
  onCancelCompare: () => void
}) {
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-gray-700 text-sm">Compare schedules</p>
        <button
          type="button"
          onClick={onCancelCompare}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500"
        >
          <X size={14} />
          Cancel compare
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <RunLabel run={run} />
          <QualityReport quality={run.quality} violations={run.violations} compact />
          <button
            type="button"
            onClick={() => onPickRun('current')}
            className="w-full py-2 text-sm rounded-xl font-semibold bg-gray-100 text-gray-600"
          >
            Use this schedule
          </button>
        </div>
        <div className="space-y-2">
          <RunLabel run={compareRun} />
          <QualityReport quality={compareRun.quality} violations={compareRun.violations} compact />
          <button
            type="button"
            onClick={() => onPickRun('compare')}
            className="w-full py-2 text-sm rounded-xl font-semibold bg-gray-100 text-gray-600"
          >
            Use this schedule
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SchedulePreview({
  run,
  compareRun,
  onReshuffle,
  onCompare,
  onPickRun,
  onCancelCompare,
  onSave,
  reshuffling,
  comparing,
  saving,
}: SchedulePreviewProps) {
  return (
    <div className="space-y-4">
      {compareRun && (
        <ComparePanel
          run={run}
          compareRun={compareRun}
          onPickRun={onPickRun}
          onCancelCompare={onCancelCompare}
        />
      )}

      <div className="card space-y-3">
        <QualityReport quality={run.quality} violations={run.violations} />
        <RunLabel run={run} />
      </div>

      <div className="space-y-4">
        {run.rounds.map((round, index) => (
          <RoundSection key={index} round={round} index={index} />
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReshuffle}
          disabled={reshuffling}
          className="flex-1 py-2 text-sm rounded-xl font-semibold bg-gray-100 text-gray-600 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Shuffle size={16} />
          {reshuffling ? 'Reshuffling…' : 'Reshuffle'}
        </button>
        <button
          type="button"
          onClick={onCompare}
          disabled={comparing}
          className="flex-1 py-2 text-sm rounded-xl font-semibold bg-gray-100 text-gray-600 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Columns2 size={16} />
          {comparing ? 'Comparing…' : 'Compare'}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 btn-primary disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
