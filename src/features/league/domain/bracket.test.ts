import { describe, it, expect } from 'vitest'
import { buildBracketPairings, isBracketComplete } from './bracket'
import type { GroupStanding, LeagueMatch } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStanding(id: string, rank: number): GroupStanding {
  return {
    team: {
      id,
      league_id: 'league-1',
      division: 'mens',
      player1_id: 'p1',
      player2_id: 'p2',
      team_name: id,
      team_song: null,
      spirit_animal: null,
      experience_level: 'intermediate',
      preferred_play_times: null,
      group_label: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    wins: 0,
    losses: 0,
    points: 0,
    setDiff: 0,
    gameDiff: 0,
    rank,
  }
}

function makeMatch(
  id: string,
  stage: LeagueMatch['stage'],
  winner_id: string | null,
): LeagueMatch {
  return {
    id,
    league_id: 'league-1',
    division: 'mens',
    stage,
    team1_id: 'team-x',
    team2_id: 'team-y',
    set_scores: null,
    winner_id,
    played_on: winner_id ? '2026-06-01' : null,
    location: null,
    created_at: '2026-01-01T00:00:00Z',
  }
}

// ---------------------------------------------------------------------------
// buildBracketPairings
// ---------------------------------------------------------------------------

describe('buildBracketPairings', () => {
  // ── 4+4 (standard) ──────────────────────────────────────────────────────────
  describe('4+4 groups (standard)', () => {
    const standings = {
      A: [makeStanding('A1', 1), makeStanding('A2', 2), makeStanding('A3', 3), makeStanding('A4', 4)],
      B: [makeStanding('B1', 1), makeStanding('B2', 2), makeStanding('B3', 3), makeStanding('B4', 4)],
    }

    it('returns 4 pairings', () => {
      expect(buildBracketPairings(standings, 'mens')).toHaveLength(4)
    })

    it('sets division on all pairings', () => {
      expect(buildBracketPairings(standings, 'womens').every((p) => p.division === 'womens')).toBe(true)
    })

    it('produces 2 gold_semi pairings', () => {
      expect(buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'gold_semi')).toHaveLength(2)
    })

    it('produces 2 silver_semi pairings', () => {
      expect(buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'silver_semi')).toHaveLength(2)
    })

    it('gold semi: A1 vs B2 and B1 vs A2 (cross-seeded)', () => {
      const gold = buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'gold_semi')
      expect(gold.find((p) => p.team1_id === 'A1' && p.team2_id === 'B2')).toBeDefined()
      expect(gold.find((p) => p.team1_id === 'B1' && p.team2_id === 'A2')).toBeDefined()
    })

    it('silver semi: A3 vs B4 and B3 vs A4 (cross-seeded)', () => {
      const silver = buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'silver_semi')
      expect(silver.find((p) => p.team1_id === 'A3' && p.team2_id === 'B4')).toBeDefined()
      expect(silver.find((p) => p.team1_id === 'B3' && p.team2_id === 'A4')).toBeDefined()
    })

    it('no null team2_id in 4+4', () => {
      expect(buildBracketPairings(standings, 'mens').every((p) => p.team2_id !== null)).toBe(true)
    })
  })

  // ── 3+3 ─────────────────────────────────────────────────────────────────────
  describe('3+3 groups', () => {
    const standings = {
      A: [makeStanding('A1', 1), makeStanding('A2', 2), makeStanding('A3', 3)],
      B: [makeStanding('B1', 1), makeStanding('B2', 2), makeStanding('B3', 3)],
    }

    it('returns 4 pairings (2 gold + 2 silver)', () => {
      expect(buildBracketPairings(standings, 'mens')).toHaveLength(4)
    })

    it('gold semis have no byes (rank 2 exists in both groups)', () => {
      const gold = buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'gold_semi')
      expect(gold.every((p) => p.team2_id !== null)).toBe(true)
    })

    it('silver semis have byes for missing rank-4 slots', () => {
      const silver = buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'silver_semi')
      expect(silver).toHaveLength(2)
      // Both A4 and B4 are absent → both silver semis are byes
      expect(silver.every((p) => p.team2_id === null)).toBe(true)
    })

    it('silver semi team1_id values are A3 and B3', () => {
      const silver = buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'silver_semi')
      const team1Ids = silver.map((p) => p.team1_id).sort()
      expect(team1Ids).toEqual(['A3', 'B3'])
    })
  })

  // ── 4+3 ─────────────────────────────────────────────────────────────────────
  describe('4+3 groups', () => {
    const standings = {
      A: [makeStanding('A1', 1), makeStanding('A2', 2), makeStanding('A3', 3), makeStanding('A4', 4)],
      B: [makeStanding('B1', 1), makeStanding('B2', 2), makeStanding('B3', 3)],
    }

    it('silver semi A3 vs B4: B4 is a bye (null)', () => {
      const silver = buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'silver_semi')
      const a3Match = silver.find((p) => p.team1_id === 'A3')
      expect(a3Match).toBeDefined()
      expect(a3Match?.team2_id).toBeNull()
    })

    it('silver semi B3 vs A4: A4 is real', () => {
      const silver = buildBracketPairings(standings, 'mens').filter((p) => p.stage === 'silver_semi')
      const b3Match = silver.find((p) => p.team1_id === 'B3')
      expect(b3Match).toBeDefined()
      expect(b3Match?.team2_id).toBe('A4')
    })
  })

  // ── 2+2 ─────────────────────────────────────────────────────────────────────
  describe('2+2 groups', () => {
    const standings = {
      A: [makeStanding('A1', 1), makeStanding('A2', 2)],
      B: [makeStanding('B1', 1), makeStanding('B2', 2)],
    }

    it('returns 2 pairings (gold only, no silver)', () => {
      expect(buildBracketPairings(standings, 'mens')).toHaveLength(2)
    })

    it('only gold_semi pairings are generated', () => {
      const pairings = buildBracketPairings(standings, 'mens')
      expect(pairings.every((p) => p.stage === 'gold_semi')).toBe(true)
    })
  })

  // ── 3+2 ─────────────────────────────────────────────────────────────────────
  describe('3+2 groups', () => {
    const standings = {
      A: [makeStanding('A1', 1), makeStanding('A2', 2), makeStanding('A3', 3)],
      B: [makeStanding('B1', 1), makeStanding('B2', 2)],
    }

    it('returns only gold semis — no silver when B has < 3 teams', () => {
      const pairings = buildBracketPairings(standings, 'mens')
      expect(pairings.filter((p) => p.stage === 'silver_semi')).toHaveLength(0)
    })
  })
})

// ---------------------------------------------------------------------------
// isBracketComplete
// ---------------------------------------------------------------------------

describe('isBracketComplete', () => {
  describe("stage: 'semi'", () => {
    it('returns false when no matches exist', () => {
      expect(isBracketComplete([], 'semi')).toBe(false)
    })

    it('returns false when only non-semi matches exist', () => {
      const matches = [
        makeMatch('m1', 'gold_final', 'team-x'),
        makeMatch('m2', 'silver_final', 'team-y'),
      ]
      expect(isBracketComplete(matches, 'semi')).toBe(false)
    })

    it('returns false when any semi match has a null winner', () => {
      const matches = [
        makeMatch('m1', 'gold_semi', 'team-x'),
        makeMatch('m2', 'gold_semi', null),
        makeMatch('m3', 'silver_semi', 'team-y'),
        makeMatch('m4', 'silver_semi', 'team-z'),
      ]
      expect(isBracketComplete(matches, 'semi')).toBe(false)
    })

    it('returns true when all semi matches have a winner', () => {
      const matches = [
        makeMatch('m1', 'gold_semi', 'team-x'),
        makeMatch('m2', 'gold_semi', 'team-y'),
        makeMatch('m3', 'silver_semi', 'team-a'),
        makeMatch('m4', 'silver_semi', 'team-b'),
      ]
      expect(isBracketComplete(matches, 'semi')).toBe(true)
    })

    it('ignores group and final stage matches when checking semis', () => {
      const matches = [
        makeMatch('m1', 'gold_semi', 'team-x'),
        makeMatch('m2', 'silver_semi', 'team-y'),
        makeMatch('m3', 'group', null),          // null but not a semi
        makeMatch('m4', 'gold_final', null),     // null but not a semi
      ]
      expect(isBracketComplete(matches, 'semi')).toBe(true)
    })
  })

  describe("stage: 'final'", () => {
    it('returns false when no matches exist', () => {
      expect(isBracketComplete([], 'final')).toBe(false)
    })

    it('returns false when only non-final matches exist', () => {
      const matches = [
        makeMatch('m1', 'gold_semi', 'team-x'),
        makeMatch('m2', 'silver_semi', 'team-y'),
      ]
      expect(isBracketComplete(matches, 'final')).toBe(false)
    })

    it('returns false when any final match has a null winner', () => {
      const matches = [
        makeMatch('m1', 'gold_final', 'team-x'),
        makeMatch('m2', 'silver_final', null),
      ]
      expect(isBracketComplete(matches, 'final')).toBe(false)
    })

    it('returns true when all final matches have a winner', () => {
      const matches = [
        makeMatch('m1', 'gold_final', 'team-x'),
        makeMatch('m2', 'silver_final', 'team-y'),
      ]
      expect(isBracketComplete(matches, 'final')).toBe(true)
    })

    it('ignores semi matches when checking finals', () => {
      const matches = [
        makeMatch('m1', 'gold_final', 'team-x'),
        makeMatch('m2', 'silver_final', 'team-y'),
        makeMatch('m3', 'gold_semi', null),    // null but not a final
      ]
      expect(isBracketComplete(matches, 'final')).toBe(true)
    })
  })
})
