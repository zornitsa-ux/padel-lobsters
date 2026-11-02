import React from 'react'
import { Download, Shuffle } from 'lucide-react'
import type { SchedulePlayer, ScheduleRound } from './types'
import { roundsForDuration } from './utils'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { Button } from '../../../components/ui/Button'
import { Tag } from '../../../components/ui/Tag'

export const TEAM_EVENT_NOTE = "The Americano schedule generator doesn't run on team events."

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
  isTeamEvent?: boolean
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
  isTeamEvent = false,
}: Props) {
  if (generated || !isAdmin) return null
  if (isTeamEvent) return <p className="card text-sm text-lob-muted">{TEAM_EVENT_NOTE}</p>

  return (
    <div className="card space-y-3">
      <p className="font-semibold text-lob-slate text-sm">Generate Schedule</p>

      <div className="flex flex-wrap gap-1.5">
        <Tag label={genderMode === 'mixed' ? '🚺🚹 Mixed · gender balanced' : '👥 Same gender'} />
        {registeredPlayers.some((player) => player.isLeftHanded) && (
          <Tag
            label={`🤚 ${registeredPlayers.filter((player) => player.isLeftHanded).length} lefty — kept separate`}
          />
        )}
        {isLobster && (
          <Tag label={`🦞 ${roundsForDuration(tournamentDuration)} rounds · partners rotate`} />
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

      <Button
        onClick={onGenerate}
        disabled={generating || registeredPlayers.length < 4}
        fullWidth
        icon={<Shuffle />}
      >
        {generating ? 'Generating...' : 'Generate Pairings'}
      </Button>

      {registeredPlayers.length < 4 && (
        <p className="text-xs text-lob-warning">Register at least 4 players first</p>
      )}

      {savedRounds.length > 0 && (
        <>
          <Button variant="secondary" fullWidth onClick={onEditSchedule}>
            ✏️ Edit existing schedule
          </Button>
          <Button
            variant="neutral"
            fullWidth
            icon={<Download />}
            onClick={onDownloadCsv}
            title="Download the saved schedule as a CSV"
          >
            Download schedule (CSV)
          </Button>
        </>
      )}

      <p className="text-xs text-lob-muted">
        {registeredPlayers.length} players · {numCourts} court{numCourts > 1 ? 's' : ''}
      </p>
    </div>
  )
}
