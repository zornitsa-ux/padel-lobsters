import type {
  EntityId,
  ScheduleMatch,
  SchedulePlayer,
  ScheduleRound,
  TournamentSummary,
} from './types'
import { allMatchesScored, isMatchScored } from '../eventPhase'

const toIdString = (id: EntityId) => String(id)

export function cloneRounds(rounds: ScheduleRound[]): ScheduleRound[] {
  return rounds.map((round) => ({
    ...round,
    matches: (round.matches || []).map((match) => ({
      ...match,
      team1Ids: [...(match.team1Ids || [])],
      team2Ids: [...(match.team2Ids || [])],
    })),
  }))
}

export function buildSavedRounds(savedMatches: ScheduleMatch[]): ScheduleRound[] {
  const byRound: Record<number, ScheduleRound> = {}
  const getCourtOrder = (label?: string) => {
    const hit = String(label ?? '').match(/(\d+)/)
    return hit ? Number.parseInt(hit[1], 10) : Number.MAX_SAFE_INTEGER
  }

  savedMatches.forEach((match) => {
    const roundNumber = match.round || 1
    if (!byRound[roundNumber]) {
      byRound[roundNumber] = {
        round: roundNumber,
        label: `Round ${roundNumber}`,
        matches: [],
      }
    }
    byRound[roundNumber].matches.push(match)
  })

  Object.values(byRound).forEach((round) => {
    round.matches.sort((a, b) => getCourtOrder(String(a.court)) - getCourtOrder(String(b.court)))
  })

  return Object.values(byRound).sort((a, b) => a.round - b.round)
}

export function hasAllMatchesScored(savedRounds: ScheduleRound[]): boolean {
  return allMatchesScored(savedRounds.flatMap((round) => round.matches))
}

export interface NextUnscoredMatch {
  roundIndex: number
  matchIndex: number
  matchId: EntityId | undefined
}

/**
 * First unscored match in round then court order — where "unscored" is
 * `isMatchScored` failing, not just `completed` being falsy, so a row flagged
 * `completed` with a missing score still counts as needing attention.
 */
export function findNextUnscoredMatch(rounds: ScheduleRound[]): NextUnscoredMatch | null {
  for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
    const matches = rounds[roundIndex].matches || []
    const matchIndex = matches.findIndex((match) => !isMatchScored(match))
    if (matchIndex !== -1) {
      return { roundIndex, matchIndex, matchId: matches[matchIndex].id }
    }
  }
  return null
}

// Generic in the player so callers holding a richer row (e.g. `Player`) keep it
// through the lookup instead of being widened to SchedulePlayer.
export function buildPlayerById<T extends { id: EntityId }>(players: T[]): Map<string, T> {
  return new Map(players.map((player) => [toIdString(player.id), player]))
}

export function getPlayerName(playerById: Map<string, SchedulePlayer>, id: EntityId): string {
  const player = playerById.get(toIdString(id))
  return player ? (player.name || '').trim() : String(id)
}

const csvCell = (value: unknown): string => {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function buildScheduleCsv(args: {
  rounds: ScheduleRound[]
  players: SchedulePlayer[]
  tournament: TournamentSummary
  numCourts: number
  registeredCount: number
  isPreview: boolean
}): { filename: string; content: string } {
  const { rounds, players, tournament, numCourts, registeredCount, isPreview } = args
  const playerById = buildPlayerById(players)

  const lines: string[] = []
  lines.push(['Round', 'Court', 'Team 1', 'Team 2', 'T1 Level', 'T2 Level'].join(','))

  rounds.forEach((round) => {
    ;(round.matches || []).forEach((match) => {
      const team1 = (match.team1Ids || []).map((id) => getPlayerName(playerById, id)).join(' + ')
      const team2 = (match.team2Ids || []).map((id) => getPlayerName(playerById, id)).join(' + ')
      lines.push(
        [
          csvCell(round.round),
          csvCell(match.court),
          csvCell(team1),
          csvCell(team2),
          csvCell(match.team1Level?.toFixed?.(2) ?? match.team1Level ?? ''),
          csvCell(match.team2Level?.toFixed?.(2) ?? match.team2Level ?? ''),
        ].join(','),
      )
    })

    const sittingIds = round.sitting || []
    if (sittingIds.length) {
      lines.push(
        [
          csvCell(round.round),
          'Sitting',
          csvCell(sittingIds.map((id) => getPlayerName(playerById, id)).join('; ')),
          '',
          '',
          '',
        ].join(','),
      )
    }
  })

  const header = [
    `# ${tournament.name || 'Padel Lobsters'} — schedule ${isPreview ? 'preview' : 'saved'}`,
    `# Format: ${tournament.format || 'lobster_matching'} · Courts: ${numCourts} · Registered: ${registeredCount}`,
    `# Generated at ${new Date().toLocaleString()}`,
    '',
  ].join('\r\n')

  const content = `${header}\r\n${lines.join('\r\n')}\r\n`
  const slug = slugify(tournament.name || 'tournament') || 'schedule'
  const filename = `padel-lobsters-${slug}-${isPreview ? 'preview' : 'saved'}.csv`
  return { filename, content }
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Lobster round count derives from event duration. Single source for the rule —
// it drives both the generated schedule and the round-count chip that advertises
// it, which previously computed it independently and could drift.
export function roundsForDuration(duration: number | null | undefined): number {
  return (duration || 90) >= 120 ? 6 : 5
}
