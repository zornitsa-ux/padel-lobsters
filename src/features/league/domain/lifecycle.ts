import { isSeasonDecided } from './bracket'
import { DIVISION_LABELS } from './types'
import type { Division, League, LeagueMatch, LeagueStatus, LeagueTeam } from './types'

export const LEAGUE_PHASES: LeagueStatus[] = ['draft', 'group_stage', 'knockout', 'completed']

export function isPublished(league: League): boolean {
  return league.published_at != null
}

export interface PhaseReadiness {
  next: LeagueStatus | null
  blocker: string | null
}

function divisionsWith(items: { division: Division }[]): Division[] {
  return [...new Set(items.map((i) => i.division))]
}

function groupStageBlocker({
  league,
  teams,
  matches,
}: {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
}): string | null {
  if (!isPublished(league)) return 'Publish the season first'
  if (teams.length === 0) return 'Add teams first'
  const missing = divisionsWith(teams).find(
    (d) => !matches.some((m) => m.division === d && m.stage === 'group'),
  )
  return missing ? `Assign ${DIVISION_LABELS[missing]} groups first` : null
}

function knockoutBlocker({ matches }: { matches: LeagueMatch[] }): string | null {
  const groupDivisions = divisionsWith(matches.filter((m) => m.stage === 'group'))
  const missing = groupDivisions.find(
    (d) => !matches.some((m) => m.division === d && m.stage === 'gold_semi'),
  )
  if (missing) return `Generate the ${DIVISION_LABELS[missing]} bracket first`
  return matches.some((m) => m.stage === 'gold_semi') ? null : 'Generate the knockout bracket first'
}

/**
 * The next phase and what, if anything, blocks moving to it. Mirrors the
 * checks in admin_update_league_status.
 */
export function phaseReadiness({
  league,
  teams,
  matches,
}: {
  league: League
  teams: LeagueTeam[]
  matches: LeagueMatch[]
}): PhaseReadiness {
  switch (league.status) {
    case 'draft':
      return { next: 'group_stage', blocker: groupStageBlocker({ league, teams, matches }) }
    case 'group_stage':
      return { next: 'knockout', blocker: knockoutBlocker({ matches }) }
    case 'knockout':
      return {
        next: 'completed',
        blocker: isSeasonDecided({ matches }) ? null : "Enter every final's score first",
      }
    default:
      return { next: null, blocker: null }
  }
}

const IN_PROGRESS = ['group_stage', 'knockout']

/**
 * The season players should land on: the newest published season in
 * progress, otherwise the newest published draft. Admins can read hidden
 * drafts, so visibility is checked here too, not only by RLS.
 */
export function pickCurrentLeague({ leagues }: { leagues: League[] }): League | null {
  const newestFirst = leagues
    .filter((l) => isPublished(l) && l.status !== 'completed')
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  return (
    newestFirst.find((l) => IN_PROGRESS.includes(l.status)) ??
    newestFirst.find((l) => l.status === 'draft') ??
    null
  )
}

export interface SeasonGroups {
  current: League | null
  upcoming: League[]
  past: League[]
}

/** Splits the seasons list into the current season, other unfinished seasons, and past ones, newest first. */
export function groupSeasons({ leagues }: { leagues: League[] }): SeasonGroups {
  const current = pickCurrentLeague({ leagues })
  const newestFirst = [...leagues].sort((a, b) =>
    (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  )
  return {
    current,
    upcoming: newestFirst.filter((l) => l.status !== 'completed' && l.id !== current?.id),
    past: newestFirst.filter((l) => l.status === 'completed'),
  }
}
