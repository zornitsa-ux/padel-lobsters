import React from 'react'
import { Download, Shuffle } from 'lucide-react'
import type { SchedulePlayer, ScheduleRound } from './types'

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
  useLobsterScore: boolean
  setUseLobsterScore: (value: boolean) => void
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
  useLobsterScore,
  setUseLobsterScore,
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
      <p className="font-semibold text-gray-700 text-sm">Generate Schedule</p>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            genderMode === 'mixed' ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-gray-600'
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
          <span className="text-xs bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full font-medium">
            🦞 {(tournamentDuration || 90) >= 120 ? 6 : 5} rounds · partners rotate
          </span>
        )}
      </div>

      {!isLobster && (format === 'americano' || format === 'mexicano') && (
        <div>
          <label className="label">Number of rounds</label>
          <div className="flex gap-2">
            {[2, 3, 4, 5, 6].map((value) => (
              <button
                key={value}
                onClick={() => setRounds(value)}
                className={`flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${
                  rounds === value ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 p-3 rounded-xl bg-lobster-cream/40 border border-lobster-teal/20 cursor-pointer active:scale-[0.99] transition-transform">
        <input
          type="checkbox"
          checked={useLobsterScore}
          onChange={(event) => setUseLobsterScore(event.target.checked)}
          className="mt-0.5 w-4 h-4 accent-lobster-teal"
        />
        <span className="text-xs text-gray-700 leading-snug">
          <span className="font-semibold text-lobster-teal">Use Lobster Score for matching</span>
          <span className="block text-[11px] text-gray-500 mt-0.5">
            When on, the matcher uses Glicko-2 shadow ratings instead of Playtomic-adjusted levels.
            Players without a Lobster Score yet fall back to their adjusted level.
          </span>
        </span>
      </label>

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
            className="w-full py-2 text-sm text-lobster-teal font-semibold border border-lobster-teal rounded-xl"
          >
            ✏️ Edit existing schedule
          </button>
          <button
            onClick={onDownloadCsv}
            className="w-full py-2 text-sm text-gray-600 font-semibold border border-gray-200 rounded-xl flex items-center justify-center gap-2"
            title="Download the saved schedule as a CSV"
          >
            <Download size={14} /> Download schedule (CSV)
          </button>
        </>
      )}

      <p className="text-xs text-gray-500">
        {registeredPlayers.length} players · {numCourts} court{numCourts > 1 ? 's' : ''}
      </p>
    </div>
  )
}
