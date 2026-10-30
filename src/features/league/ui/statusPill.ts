import type { BadgeTone } from '../../../components/ui/Badge'

export interface StatusPill {
  tone: BadgeTone
  label: string
}

// `leagues.status` is constrained by a CHECK to the four LeagueStatus values,
// so the maps that key off it are exhaustive today. They are still typed and
// read as Record<string, …> because the constraint is the DB's invariant, not
// the app's: a status added in a migration reaches the client before any
// TypeScript knows about it. Callers that destructured the lookup directly
// turned that case into a TypeError on render (a blank League page), which is
// what this exists to prevent — an unknown status degrades to a neutral badge
// showing the raw value.
// Object.hasOwn rather than `map[status] ??`: a bare lookup finds inherited
// Object.prototype members, so a status of 'toString' would return a function
// instead of falling back.
export function statusPill(map: Record<string, StatusPill>, status: string): StatusPill {
  return Object.hasOwn(map, status) ? map[status] : { tone: 'neutral', label: status }
}

// One colour per phase, whatever the copy: draft, then groups, knockout, done.
export const LEAGUE_STATUS_TONE = {
  draft: 'accent',
  group_stage: 'outline',
  knockout: 'brand',
  completed: 'neutral',
} as const satisfies Record<string, BadgeTone>

// Admin-facing and seasons-list labels. LeagueHome and the dashboard card keep
// their own player-facing copy ("Registering", "Coming Soon").
export const leagueStatusPills = (
  labels: Record<keyof typeof LEAGUE_STATUS_TONE, string>,
): Record<string, StatusPill> =>
  Object.fromEntries(
    Object.entries(LEAGUE_STATUS_TONE).map(([status, tone]) => [
      status,
      { tone, label: labels[status as keyof typeof LEAGUE_STATUS_TONE] },
    ]),
  )

export const LEAGUE_STATUS_PILL = leagueStatusPills({
  draft: 'Draft',
  group_stage: 'Group Stage',
  knockout: 'Knockout',
  completed: 'Completed',
})

const EXPERIENCE_TONE: Record<string, BadgeTone> = {
  advanced: 'brand',
  intermediate: 'accent',
  beginner: 'neutral',
}

export const experienceTone = (level: string): BadgeTone =>
  Object.hasOwn(EXPERIENCE_TONE, level) ? EXPERIENCE_TONE[level] : 'neutral'
