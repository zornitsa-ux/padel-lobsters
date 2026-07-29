import React from 'react'
import { Download, Shuffle } from 'lucide-react'
import type { SchedulePlayer, ScheduleRound } from './types'
import { roundsForDuration } from './utils'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'

type Props = {
  generated: unknown
  isAdmin: boolean
  format: string
  genderMode: string
  isLobster: boolean
  registeredPlayers: SchedulePlayer[]
  numCourts: number
  rounds: number
  setRounds: (value: number) => void
  onGenerate: () => void
  generating: boolean
  savedRounds: ScheduleRound[]
  onEditSchedule: () => void
  onDownloadCsv: () => void
  tournamentDuration?: number
}

export default function ScheduleGeneratorControls({
  generated,
  isAdmin,
  format,
  genderMode,
  isLobster,
  registeredPlayers,
  numCourts,
  rounds,
  setRounds,
  onGenerate,
  generating,
  savedRounds,
  onEditSchedule,
  onDownloadCsv,
  tournamentDuration,
}: Props) {
  if (generated || !isAdmin) return null

  return (
    <div className="card space-y-3">
      <p className="font-semibold text-lob-slate text-sm">Generate Schedule</p>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            genderMode === 'mixed' ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-lob-slate'
          }`}
        >
          {genderMode === 'mixed' ? '🚺🚹 Mixed · gender balanced' : '👥 Same gender'}
        </span>
        {registeredPlayers.some((player) => player.isLeftHanded) && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
            🤚 {registeredPlayers.filter((player) => player.isLeftHanded).length} lefty — kept
            separate
          </span>
        )}
        {isLobster && (
          <span className="text-xs bg-lob-cream text-lob-teal px-2 py-0.5 rounded-full font-medium">
            🦞 {roundsForDuration(tournamentDuration)} rounds · partners rotate
          </span>
        )}
      </div>

      {!isLobster && (format === 'americano' || format === 'mexicano') && (
        <div>
          <label className="label">Number of rounds</label>
          <SegmentedControl
            ariaLabel="Number of rounds"
            options={[2, 3, 4, 5, 6].map((value) => ({ value, label: String(value) }))}
            value={rounds}
            onChange={setRounds}
          />
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={generating || registeredPlayers.length < 4}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Shuffle size={16} />
        {generating ? 'Generating...' : 'Generate Pairings'}
      </button>

      {registeredPlayers.length < 4 && (
        <p className="text-xs text-orange-600">Register at least 4 players first</p>
      )}

      {savedRounds.length > 0 && (
        <>
          <button
            onClick={onEditSchedule}
            className="w-full py-2 text-sm text-lob-teal font-semibold border border-lob-teal rounded-xl"
          >
            ✏️ Edit existing schedule
          </button>
          <button
            onClick={onDownloadCsv}
            className="w-full py-2 text-sm text-lob-slate font-semibold border border-gray-200 rounded-xl flex items-center justify-center gap-2"
            title="Download the saved schedule as a CSV"
          >
            <Download size={14} /> Download schedule (CSV)
          </button>
        </>
      )}

      <p className="text-xs text-lob-muted">
        {registeredPlayers.length} players · {numCourts} court{numCourts > 1 ? 's' : ''}
      </p>
    </div>
  )
}
