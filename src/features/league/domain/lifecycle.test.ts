import { describe, it, expect } from 'vitest'
import { groupSeasons, phaseReadiness, pickCurrentLeague } from './lifecycle'
import { mkLeague, mkLeagueMatch, mkLeagueTeam } from '../../../test/leagueFactories'

describe('phaseReadiness', () => {
  const mensTeam = mkLeagueTeam({ id: 'm1' })
  const womensTeam = mkLeagueTeam({ id: 'w1', division: 'womens' })
  const mensGroup = mkLeagueMatch({ id: 'mg', stage: 'group' })
  const womensGroup = mkLeagueMatch({ id: 'wg', stage: 'group', division: 'womens' })
  const mensSemi = mkLeagueMatch({ id: 'ms', stage: 'gold_semi' })

  describe('draft → group stage', () => {
    const draft = mkLeague({ status: 'draft' })

    it('needs the season to be published', () => {
      const league = mkLeague({ status: 'draft', published_at: null })
      expect(phaseReadiness({ league, teams: [mensTeam], matches: [mensGroup] })).toEqual({
        next: 'group_stage',
        blocker: 'Publish the season first',
      })
    })

    it('needs teams', () => {
      expect(phaseReadiness({ league: draft, teams: [], matches: [] }).blocker).toBe(
        'Add teams first',
      )
    })

    it('needs fixtures in every division that has teams', () => {
      expect(
        phaseReadiness({ league: draft, teams: [mensTeam, womensTeam], matches: [mensGroup] })
          .blocker,
      ).toBe("Assign Women's groups first")
    })

    it('is ready once every division has fixtures', () => {
      expect(
        phaseReadiness({
          league: draft,
          teams: [mensTeam, womensTeam],
          matches: [mensGroup, womensGroup],
        }).blocker,
      ).toBeNull()
    })
  })

  describe('group stage → knockout', () => {
    const league = mkLeague({ status: 'group_stage' })

    it('needs a bracket in every division that played groups', () => {
      expect(
        phaseReadiness({ league, teams: [], matches: [mensGroup, womensGroup, mensSemi] }).blocker,
      ).toBe("Generate the Women's bracket first")
    })

    it('needs some bracket at all', () => {
      expect(phaseReadiness({ league, teams: [], matches: [] }).blocker).toBe(
        'Generate the knockout bracket first',
      )
    })

    it('is ready once every division has its bracket', () => {
      expect(phaseReadiness({ league, teams: [], matches: [mensGroup, mensSemi] })).toEqual({
        next: 'knockout',
        blocker: null,
      })
    })
  })

  describe('knockout → completed', () => {
    const league = mkLeague({ status: 'knockout' })

    it('needs every final decided', () => {
      expect(phaseReadiness({ league, teams: [], matches: [mensSemi] }).blocker).toBe(
        "Enter every final's score first",
      )
    })

    it('is ready once the finals are decided', () => {
      const final = mkLeagueMatch({ id: 'mf', stage: 'gold_final', winner_id: 'm1' })
      expect(phaseReadiness({ league, teams: [], matches: [mensSemi, final] }).blocker).toBeNull()
    })
  })

  it('has no next phase once completed', () => {
    expect(
      phaseReadiness({ league: mkLeague({ status: 'completed' }), teams: [], matches: [] }),
    ).toEqual({ next: null, blocker: null })
  })
})

describe('pickCurrentLeague', () => {
  const running = mkLeague({ id: 'running', status: 'knockout', created_at: '2026-05-01' })
  const nextDraft = mkLeague({ id: 'next', status: 'draft', created_at: '2026-09-01' })
  const hiddenDraft = mkLeague({
    id: 'hidden',
    status: 'draft',
    created_at: '2026-10-01',
    published_at: null,
  })
  const past = mkLeague({ id: 'past', status: 'completed', created_at: '2025-05-01' })

  it('prefers a season in progress over a newer draft', () => {
    expect(pickCurrentLeague({ leagues: [nextDraft, running, past] })?.id).toBe('running')
  })

  it('never picks a hidden draft', () => {
    expect(pickCurrentLeague({ leagues: [hiddenDraft, past] })).toBeNull()
  })

  it('falls back to the newest published draft', () => {
    expect(pickCurrentLeague({ leagues: [hiddenDraft, nextDraft, past] })?.id).toBe('next')
  })

  it('returns null when every season is completed', () => {
    expect(pickCurrentLeague({ leagues: [past] })).toBeNull()
  })
})

describe('groupSeasons', () => {
  const running = mkLeague({ id: 'running', status: 'group_stage', created_at: '2026-05-01' })
  const hiddenDraft = mkLeague({
    id: 'hidden',
    status: 'draft',
    created_at: '2026-10-01',
    published_at: null,
  })
  const older = mkLeague({ id: 'older', status: 'completed', created_at: '2025-05-01' })
  const newer = mkLeague({ id: 'newer', status: 'completed', created_at: '2025-09-01' })

  it('splits current, upcoming and past seasons, newest first', () => {
    expect(groupSeasons({ leagues: [older, running, hiddenDraft, newer] })).toEqual({
      current: running,
      upcoming: [hiddenDraft],
      past: [newer, older],
    })
  })

  it('has no current season when only hidden drafts and past seasons exist', () => {
    expect(groupSeasons({ leagues: [hiddenDraft, older] }).current).toBeNull()
  })
})
