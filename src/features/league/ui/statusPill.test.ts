import { describe, expect, it } from 'vitest'
import { experienceTone, leagueStatusPills, statusPill, type StatusPill } from './statusPill'

const MAP: Record<string, StatusPill> = {
  draft: { tone: 'accent', label: 'Registering' },
  completed: { tone: 'neutral', label: 'Completed' },
}

describe('statusPill', () => {
  it('returns the mapped pill for a known status', () => {
    expect(statusPill(MAP, 'draft')).toEqual({ tone: 'accent', label: 'Registering' })
  })

  // The regression this guards: LeagueHome and LeagueDashboardCard used to
  // destructure the map lookup directly, so production's legacy
  // 'signups_open' row rendered a TypeError instead of a badge.
  it('falls back to a neutral pill showing the raw value for an unknown status', () => {
    expect(statusPill(MAP, 'signups_open')).toEqual({ tone: 'neutral', label: 'signups_open' })
  })

  it('does not treat an inherited Object property as a known status', () => {
    expect(statusPill(MAP, 'toString')).toEqual({ tone: 'neutral', label: 'toString' })
  })
})

describe('experienceTone', () => {
  it('tones each level, and anything else as neutral', () => {
    expect(experienceTone('advanced')).toBe('brand')
    expect(experienceTone('intermediate')).toBe('accent')
    expect(experienceTone('beginner')).toBe('neutral')
    expect(experienceTone('toString')).toBe('neutral')
  })
})

describe('leagueStatusPills', () => {
  it('pairs each phase label with the phase tone', () => {
    const pills = leagueStatusPills({
      draft: 'Coming Soon',
      group_stage: 'Groups',
      knockout: 'Knockout',
      completed: 'Done',
    })
    expect(pills.draft).toEqual({ tone: 'accent', label: 'Coming Soon' })
    expect(pills.knockout).toEqual({ tone: 'brand', label: 'Knockout' })
  })
})
