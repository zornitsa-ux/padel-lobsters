import { describe, it, expect } from 'vitest'
import { REVIEW_SCENARIOS, corpReview } from './reviewScenarios'

// corpReview is pure: same player + same match/registration/tournament data
// always yields the same scenario. No alias map is passed anywhere below, so
// the hardcoded historical TOURNAMENTS never contribute appearances — but they
// do set the Ironman/Ghost denominator (3 non-ladies legacy events), which is
// why the fixtures register for two DB tournaments: one is a 1-in-4 attendance
// ratio and always trips the Ghost branch.

const player = (over: Partial<{ id: string; name: string; playtomicLevel: number }> = {}) => ({
  id: 'p1',
  name: 'Ada Lovelace',
  playtomicLevel: 3.0,
  ...over,
})

const tournaments = [
  { id: 't1', date: '2020-01-01', status: 'completed' },
  { id: 't2', date: '2020-02-01', status: 'completed' },
]
const registrations = [
  { playerId: 'p1', tournamentId: 't1', status: 'registered' },
  { playerId: 'p1', tournamentId: 't2', status: 'registered' },
]

// A 4-player Americano round: p1 & partner vs two opponents. Four ranked
// players means computeTournamentStandings produces a usable finishing rank.
const match = (score1: number, score2: number, round = 1) => ({
  tournamentId: 't1',
  team1Ids: ['p1', 'p2'],
  team2Ids: ['p3', 'p4'],
  score1,
  score2,
  completed: true,
  round,
})

// A two-player match leaves standings below the 4-player minimum, so no
// tournament rank is derived and the rank-based branches are skipped.
const unrankedMatch = (score1: number, score2: number, round = 1) => ({
  ...match(score1, score2, round),
  team1Ids: ['p1'],
  team2Ids: ['p3'],
})

describe('corpReview — scenario selection', () => {
  it('returns the welcome scenario when there is no history at all', () => {
    const r = corpReview(player())

    expect(r.scenario).toBe('welcome')
    expect(r.hasLabel).toBe(false)
    expect(r.text).toBe(r.body)
  })

  it('flags a player who won the most recent ranked tournament', () => {
    const matches = [match(6, 2), match(6, 3, 2), match(6, 4, 3)]

    expect(corpReview(player(), matches, registrations, tournaments).scenario).toBe('recent-winner')
  })

  it('prefixes titled scenarios with their label but leaves filler untitled', () => {
    const titled = corpReview(
      player(),
      [match(6, 2), match(6, 3, 2), match(6, 4, 3)],
      registrations,
      tournaments,
    )
    const untitled = corpReview(player())

    expect(titled.hasLabel).toBe(true)
    expect(titled.text).toBe(`${titled.scenarioLabel} — ${titled.body}`)
    expect(untitled.hasLabel).toBe(false)
    expect(untitled.text).toBe(untitled.body)
  })

  it('calls a player with a single match a rookie', () => {
    const r = corpReview(player(), [unrankedMatch(6, 4)], registrations, tournaments)

    expect(r.scenario).toBe('rookie')
  })

  it('separates the win-rate bands once the sample is big enough', () => {
    const scenarioFor = (wins: number, losses: number) => {
      const played = [
        ...Array.from({ length: wins }, (_, i) => unrankedMatch(6, 2, i + 1)),
        ...Array.from({ length: losses }, (_, i) => unrankedMatch(2, 6, wins + i + 1)),
      ]
      return corpReview(player(), played, registrations, tournaments).scenario
    }

    expect(scenarioFor(4, 0)).toBe('dominant') // 100%
    expect(scenarioFor(3, 2)).toBe('quietly-winning') // 60%
    expect(scenarioFor(2, 2)).toBe('mediocre') // 50%
    expect(scenarioFor(1, 2)).toBe('quietly-losing') // 33%
    expect(scenarioFor(1, 4)).toBe('committed-loser') // 20%
  })

  it('reports attendance with no logged results as shows-up-no-data', () => {
    const r = corpReview(player(), [], registrations, tournaments)

    expect(r.scenario).toBe('shows-up-no-data')
    expect(r.hasLabel).toBe(false)
  })

  it('calls a player who attended one of four known events a ghost', () => {
    const r = corpReview(player(), [], [registrations[0]], [tournaments[0]])

    expect(r.scenario).toBe('ghost')
  })

  it('is deterministic for the same player id', () => {
    expect(corpReview(player()).text).toBe(corpReview(player()).text)
  })

  it('varies the welcome copy across player ids', () => {
    const variants = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => corpReview(player({ id })).text),
    )

    expect(variants.size).toBeGreaterThan(1)
  })
})

describe('REVIEW_SCENARIOS', () => {
  it('has a unique id per scenario', () => {
    const ids = REVIEW_SCENARIOS.map((s) => s.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every scenario a label', () => {
    expect(REVIEW_SCENARIOS.filter((s) => !s.label)).toEqual([])
  })
})
