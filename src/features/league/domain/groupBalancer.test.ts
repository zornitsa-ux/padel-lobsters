import { describe, it, expect } from 'vitest'
import { suggestGroups, recommendGroupConfig } from './groupBalancer'
import type { LeagueTeam, ExperienceLevel } from './types'

// ---------------------------------------------------------------------------
// Minimal factory helper
// ---------------------------------------------------------------------------

let _teamSeq = 0
function makeTeam(id: string, experience_level: ExperienceLevel): LeagueTeam {
  _teamSeq++
  return {
    id,
    league_id: 'league1',
    division: 'mens',
    player1_id: '',
    player2_id: '',
    team_name: null,
    team_song: null,
    spirit_animal: null,
    experience_level,
    preferred_play_times: null,
    group_label: null,
    created_at: '',
  }
}

// ---------------------------------------------------------------------------
// suggestGroups
// ---------------------------------------------------------------------------

describe('suggestGroups', () => {
  it('splits 8 teams into 4 per group', () => {
    const teams = [
      makeTeam('a1', 'advanced'),
      makeTeam('a2', 'advanced'),
      makeTeam('i1', 'intermediate'),
      makeTeam('i2', 'intermediate'),
      makeTeam('i3', 'intermediate'),
      makeTeam('i4', 'intermediate'),
      makeTeam('b1', 'beginner'),
      makeTeam('b2', 'beginner'),
    ]
    const { A, B } = suggestGroups(teams)
    expect(A).toHaveLength(4)
    expect(B).toHaveLength(4)
  })

  it('places every team in exactly one group', () => {
    const teams = [
      makeTeam('a1', 'advanced'),
      makeTeam('a2', 'advanced'),
      makeTeam('i1', 'intermediate'),
      makeTeam('i2', 'intermediate'),
      makeTeam('b1', 'beginner'),
      makeTeam('b2', 'beginner'),
    ]
    const { A, B } = suggestGroups(teams)
    const allIds = [...A, ...B].map((t) => t.id).sort()
    const teamIds = teams.map((t) => t.id).sort()
    expect(allIds).toEqual(teamIds)

    // No duplicates between A and B
    const aIds = new Set(A.map((t) => t.id))
    const bIds = new Set(B.map((t) => t.id))
    for (const id of aIds) expect(bIds.has(id)).toBe(false)
  })

  it('distributes experience levels evenly — both groups get an advanced team', () => {
    const teams = [
      makeTeam('adv1', 'advanced'),
      makeTeam('adv2', 'advanced'),
      makeTeam('int1', 'intermediate'),
      makeTeam('int2', 'intermediate'),
      makeTeam('beg1', 'beginner'),
      makeTeam('beg2', 'beginner'),
    ]
    const { A, B } = suggestGroups(teams)

    const levelCount = (group: LeagueTeam[], level: ExperienceLevel) =>
      group.filter((t) => t.experience_level === level).length

    // Alternating from sorted list: both groups should receive 1 advanced team each
    expect(levelCount(A, 'advanced')).toBe(1)
    expect(levelCount(B, 'advanced')).toBe(1)
  })

  it('distributes experience levels evenly across 8 teams', () => {
    const teams = [
      makeTeam('adv1', 'advanced'),
      makeTeam('adv2', 'advanced'),
      makeTeam('int1', 'intermediate'),
      makeTeam('int2', 'intermediate'),
      makeTeam('int3', 'intermediate'),
      makeTeam('int4', 'intermediate'),
      makeTeam('beg1', 'beginner'),
      makeTeam('beg2', 'beginner'),
    ]
    const { A, B } = suggestGroups(teams)

    const levelCount = (group: LeagueTeam[], level: ExperienceLevel) =>
      group.filter((t) => t.experience_level === level).length

    expect(levelCount(A, 'advanced')).toBe(1)
    expect(levelCount(B, 'advanced')).toBe(1)
    expect(levelCount(A, 'intermediate')).toBe(2)
    expect(levelCount(B, 'intermediate')).toBe(2)
    expect(levelCount(A, 'beginner')).toBe(1)
    expect(levelCount(B, 'beginner')).toBe(1)
  })

  it('handles an odd number of teams — A gets one more than B', () => {
    const teams = [
      makeTeam('adv1', 'advanced'),
      makeTeam('int1', 'intermediate'),
      makeTeam('beg1', 'beginner'),
    ]
    const { A, B } = suggestGroups(teams)
    expect(A).toHaveLength(2)
    expect(B).toHaveLength(1)
  })

  it('returns empty groups for empty input', () => {
    const { A, B } = suggestGroups([])
    expect(A).toHaveLength(0)
    expect(B).toHaveLength(0)
  })

  it('assigns a single team to group A', () => {
    const teams = [makeTeam('solo', 'beginner')]
    const { A, B } = suggestGroups(teams)
    expect(A).toHaveLength(1)
    expect(A[0].id).toBe('solo')
    expect(B).toHaveLength(0)
  })

  it('preserves team objects (same references)', () => {
    const teams = [
      makeTeam('t1', 'advanced'),
      makeTeam('t2', 'beginner'),
    ]
    const { A, B } = suggestGroups(teams)
    const all = [...A, ...B]
    for (const team of teams) {
      expect(all).toContain(team)
    }
  })

  it('does not mutate the input array', () => {
    const teams = [
      makeTeam('adv1', 'advanced'),
      makeTeam('beg1', 'beginner'),
      makeTeam('int1', 'intermediate'),
    ]
    const originalOrder = teams.map((t) => t.id)
    suggestGroups(teams)
    expect(teams.map((t) => t.id)).toEqual(originalOrder)
  })
})

// ---------------------------------------------------------------------------
// recommendGroupConfig
// ---------------------------------------------------------------------------

describe('recommendGroupConfig', () => {
  it('splits 8 teams into 4+4', () => {
    const r = recommendGroupConfig(8)
    expect(r.sizeA).toBe(4)
    expect(r.sizeB).toBe(4)
  })

  it('splits 7 teams into 4+3 (A gets the extra)', () => {
    const r = recommendGroupConfig(7)
    expect(r.sizeA).toBe(4)
    expect(r.sizeB).toBe(3)
  })

  it('splits 6 teams into 3+3', () => {
    const r = recommendGroupConfig(6)
    expect(r.sizeA).toBe(3)
    expect(r.sizeB).toBe(3)
  })

  it('splits 5 teams into 3+2', () => {
    const r = recommendGroupConfig(5)
    expect(r.sizeA).toBe(3)
    expect(r.sizeB).toBe(2)
  })

  it('splits 4 teams into 2+2', () => {
    const r = recommendGroupConfig(4)
    expect(r.sizeA).toBe(2)
    expect(r.sizeB).toBe(2)
  })

  it('8 teams: full silver bracket (no byes)', () => {
    expect(recommendGroupConfig(8).silverBracket).toBe('semis')
  })

  it('10 teams: full silver bracket', () => {
    expect(recommendGroupConfig(10).silverBracket).toBe('semis')
  })

  it('6 teams: silver bracket with byes (groups of 3, no rank-4)', () => {
    expect(recommendGroupConfig(6).silverBracket).toBe('semis_with_byes')
  })

  it('7 teams: silver bracket with byes (B has 3 teams, no rank-4 in B)', () => {
    expect(recommendGroupConfig(7).silverBracket).toBe('semis_with_byes')
  })

  it('4 teams: no silver bracket (groups too small)', () => {
    expect(recommendGroupConfig(4).silverBracket).toBe('none')
  })

  it('5 teams: no silver bracket (B has only 2 teams)', () => {
    expect(recommendGroupConfig(5).silverBracket).toBe('none')
  })

  it('returns a warning for fewer than 4 teams', () => {
    expect(recommendGroupConfig(3).warning).toBeDefined()
  })

  it('no warning for 4+ teams', () => {
    expect(recommendGroupConfig(4).warning).toBeUndefined()
    expect(recommendGroupConfig(8).warning).toBeUndefined()
  })
})
