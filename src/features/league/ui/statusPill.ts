import type { BadgeProps } from '../../../components/ui/Badge'

export interface StatusPill {
  variant: BadgeProps['variant']
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
  return Object.hasOwn(map, status) ? map[status] : { variant: 'info', label: status }
}
