import { describe, expect, it } from 'vitest'
import { statusPill, type StatusPill } from './statusPill'

const MAP: Record<string, StatusPill> = {
  draft: { variant: 'league-draft', label: 'Registering' },
  completed: { variant: 'league-completed', label: 'Completed' },
}

describe('statusPill', () => {
  it('returns the mapped pill for a known status', () => {
    expect(statusPill(MAP, 'draft')).toEqual({ variant: 'league-draft', label: 'Registering' })
  })

  // The regression this guards: LeagueHome and LeagueDashboardCard used to
  // destructure the map lookup directly, so production's legacy
  // 'signups_open' row rendered a TypeError instead of a badge.
  it('falls back to a neutral pill showing the raw value for an unknown status', () => {
    expect(statusPill(MAP, 'signups_open')).toEqual({ variant: 'info', label: 'signups_open' })
  })

  it('does not treat an inherited Object property as a known status', () => {
    expect(statusPill(MAP, 'toString')).toEqual({ variant: 'info', label: 'toString' })
  })
})
