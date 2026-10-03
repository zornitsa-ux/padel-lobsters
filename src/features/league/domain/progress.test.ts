import { describe, it, expect } from 'vitest'
import { divisionProgress } from './progress'
import { mkLeagueMatch, mkLeagueTeam } from '../../../test/leagueFactories'

describe('divisionProgress', () => {
  const teams = [
    mkLeagueTeam({ id: 'm1' }),
    mkLeagueTeam({ id: 'm2' }),
    mkLeagueTeam({ id: 'w1', division: 'womens' }),
  ]
  const matches = [
    mkLeagueMatch({ id: 'g1', stage: 'group', winner_id: 'm1' }),
    mkLeagueMatch({ id: 'g2', stage: 'group' }),
    mkLeagueMatch({ id: 'gs', stage: 'gold_semi', winner_id: 'm1' }),
    mkLeagueMatch({ id: 'ss', stage: 'silver_semi', winner_id: 'm2' }),
    mkLeagueMatch({ id: 'gf', stage: 'gold_final' }),
    mkLeagueMatch({ id: 'wg', stage: 'group', division: 'womens', winner_id: 'w1' }),
  ]

  it('counts played and total matches per stage for one division', () => {
    expect(divisionProgress({ teams, matches, division: 'mens' })).toEqual({
      teams: 2,
      group: { played: 1, total: 2 },
      semis: { played: 2, total: 2 },
      finals: { played: 0, total: 1 },
    })
  })

  it('reports zero totals for stages not yet created', () => {
    expect(divisionProgress({ teams, matches, division: 'womens' })).toEqual({
      teams: 1,
      group: { played: 1, total: 1 },
      semis: { played: 0, total: 0 },
      finals: { played: 0, total: 0 },
    })
  })
})
