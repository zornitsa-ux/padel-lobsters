import { describe, it, expect } from 'vitest'
import { divisionChampions } from './champions'
import { mkLeagueMatch } from '../../../test/leagueFactories'

describe('divisionChampions', () => {
  it('returns the gold and silver final winners', () => {
    const divMatches = [
      mkLeagueMatch({ id: 'gs', stage: 'gold_semi', winner_id: 't9' }),
      mkLeagueMatch({ id: 'gf', stage: 'gold_final', winner_id: 't1' }),
      mkLeagueMatch({ id: 'sf', stage: 'silver_final', winner_id: 't2' }),
    ]
    expect(divisionChampions({ divMatches })).toEqual({ gold: 't1', silver: 't2' })
  })

  it('returns null for finals that are undecided or missing', () => {
    const divMatches = [mkLeagueMatch({ id: 'gf', stage: 'gold_final' })]
    expect(divisionChampions({ divMatches })).toEqual({ gold: null, silver: null })
  })
})
