// ============================================================================
//  mm-gender-sim.ts — court gender-balance harness for the V2 matcher (dev-only)
//
//  Generates schedules for synthetic mixed rosters (or a real roster JSON) and
//  reports uneven courts against the unavoidable floor, plus team-gap and
//  lone-player rotation stats. Baseline + tuning gate for
//  docs/gender-rebalance/PLAN.md.
//
//  Usage:
//    npx vite-node scripts/mm-gender-sim.ts
//    npx vite-node scripts/mm-gender-sim.ts -- --preset social --seeds 20
//    npx vite-node scripts/mm-gender-sim.ts -- --weights '{"mixedPreference":1}'
//    npx vite-node scripts/mm-gender-sim.ts -- --roster /path/roster.json --courts 7
//
//  Roster JSON: [{ playerId, mu, sigma, isLeftHanded, gender }] — see PLAN.md
//  §7 for the read-only query that produces it. Keep real rosters out of git.
//
//  Uneven court: both teams fully gendered (no 'unknown') and their female
//  counts differ. Floor per round: 1 when the playing female count is odd and
//  nobody playing is 'unknown', else 0 (even courts hold 0, 2 or 4 women).
// ============================================================================

import { readFileSync } from 'node:fs'
import { generateSchedule } from '../src/features/matchmaking/domain/generate'
import { createRng } from '../src/features/matchmaking/domain/rng'
import type {
  MatchPreset,
  PlayerInput,
  ScheduleRun,
  Weights,
} from '../src/features/matchmaking/domain/types'

type Case = { label: string; players: (seed: number) => PlayerInput[]; courts: number }

type Options = {
  preset: MatchPreset
  seeds: number
  rounds: number
  weights: Partial<Weights> | undefined
  rosterPath: string | undefined
  courts: number | undefined
}

type Tally = {
  courts: number
  uneven: number
  floor: number
  ffTeamCourts: number
  gaps: number[]
  loneRepeats: number
  ms: number
  runs: number
}

const SYNTHETIC: { males: number; females: number; courts: number }[] = [
  { males: 18, females: 10, courts: 7 },
  { males: 17, females: 11, courts: 7 },
  { males: 22, females: 10, courts: 8 },
  { males: 13, females: 7, courts: 5 },
]

// Means/spread approximate recent rosters: women ~1.8, men ~2.3.
const syntheticRoster = ({
  seed,
  males,
  females,
}: {
  seed: number
  males: number
  females: number
}): PlayerInput[] => {
  const rng = createRng(seed)
  const normal = () => {
    let sum = 0
    for (let i = 0; i < 6; i++) sum += rng.next()
    return (sum - 3) / 1.2
  }
  const make = (gender: 'male' | 'female', i: number, mean: number): PlayerInput => ({
    playerId: `${gender[0]}${i}`,
    name: `${gender[0]}${i}`,
    mu: Math.max(0.3, mean + 0.75 * normal()),
    sigma: 0.3,
    isLeftHanded: false,
    gender,
  })
  return [
    ...Array.from({ length: males }, (_, i) => make('male', i, 2.3)),
    ...Array.from({ length: females }, (_, i) => make('female', i, 1.8)),
  ]
}

const loadRoster = (path: string): PlayerInput[] =>
  (JSON.parse(readFileSync(path, 'utf8')) as Omit<PlayerInput, 'name'>[]).map((p) => ({
    ...p,
    name: p.playerId,
  }))

const parseArgs = (argv: string[]): Options => {
  const value = (flag: string) => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const weights = value('--weights')
  const courts = value('--courts')
  return {
    preset: (value('--preset') as MatchPreset | undefined) ?? 'balanced',
    seeds: Number(value('--seeds') ?? 10),
    rounds: Number(value('--rounds') ?? 6),
    weights: weights ? (JSON.parse(weights) as Partial<Weights>) : undefined,
    rosterPath: value('--roster'),
    courts: courts ? Number(courts) : undefined,
  }
}

const buildCases = (options: Options): Case[] => {
  if (options.rosterPath) {
    const roster = loadRoster(options.rosterPath)
    const courts = options.courts ?? Math.floor(roster.length / 4)
    return [{ label: `${options.rosterPath} (${courts}c)`, players: () => roster, courts }]
  }
  return SYNTHETIC.map(({ males, females, courts }) => ({
    label: `${males}M/${females}F ${courts}c`,
    players: (seed) => syntheticRoster({ seed, males, females }),
    courts,
  }))
}

const femaleCount = (team: readonly string[], gender: Map<string, string>) =>
  team.filter((id) => gender.get(id) === 'female').length

const hasUnknown = (ids: readonly string[], gender: Map<string, string>) =>
  ids.some((id) => gender.get(id) !== 'male' && gender.get(id) !== 'female')

const lonePlayer = (
  teams: readonly (readonly string[])[],
  gender: Map<string, string>,
): string | null => {
  const four = teams.flat()
  const women = four.filter((id) => gender.get(id) === 'female')
  if (women.length === 1) return women[0]
  if (women.length === 3) return four.find((id) => gender.get(id) === 'male') ?? null
  return null
}

const tallyRun = ({ run, players }: { run: ScheduleRun; players: PlayerInput[] }) => {
  const gender = new Map(players.map((p) => [p.playerId, p.gender]))
  const mu = new Map(players.map((p) => [p.playerId, p.mu]))
  const loneCounts = new Map<string, number>()
  const tally = { courts: 0, uneven: 0, floor: 0, ffTeamCourts: 0, gaps: [] as number[] }

  for (const round of run.rounds) {
    const playing = round.courts.flatMap((court) => court.teams.flat())
    const playingWomen = playing.filter((id) => gender.get(id) === 'female').length
    if (playingWomen % 2 === 1 && !hasUnknown(playing, gender)) tally.floor += 1

    for (const court of round.courts) {
      const [team1, team2] = court.teams
      tally.courts += 1
      const teamSum = (team: readonly string[]) => team.reduce((s, id) => s + (mu.get(id) ?? 0), 0)
      tally.gaps.push(Math.abs(teamSum(team1) - teamSum(team2)))
      if (femaleCount(team1, gender) === 2 || femaleCount(team2, gender) === 2) {
        tally.ffTeamCourts += 1
      }
      const uneven =
        !hasUnknown([...team1, ...team2], gender) &&
        femaleCount(team1, gender) !== femaleCount(team2, gender)
      if (!uneven) continue
      tally.uneven += 1
      const lone = lonePlayer(court.teams, gender)
      if (lone) loneCounts.set(lone, (loneCounts.get(lone) ?? 0) + 1)
    }
  }

  const loneRepeats = [...loneCounts.values()].reduce((s, n) => s + Math.max(0, n - 1), 0)
  return { ...tally, loneRepeats }
}

const runCase = ({ testCase, options }: { testCase: Case; options: Options }): Tally => {
  const total: Tally = {
    courts: 0,
    uneven: 0,
    floor: 0,
    ffTeamCourts: 0,
    gaps: [],
    loneRepeats: 0,
    ms: 0,
    runs: 0,
  }
  for (let seed = 1; seed <= options.seeds; seed++) {
    const players = testCase.players(seed)
    const started = performance.now()
    const run = generateSchedule({
      tournamentId: `sim-${seed}`,
      players,
      courts: testCase.courts,
      rounds: options.rounds,
      genderMode: 'mixed',
      config: {
        preset: options.preset,
        seed,
        ...(options.weights && { weights: options.weights }),
      },
    })
    total.ms += performance.now() - started
    total.runs += 1
    const tally = tallyRun({ run, players })
    total.courts += tally.courts
    total.uneven += tally.uneven
    total.floor += tally.floor
    total.ffTeamCourts += tally.ffTeamCourts
    total.gaps.push(...tally.gaps)
    total.loneRepeats += tally.loneRepeats
  }
  return total
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

const pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0)}%`

const formatRow = ({ label, tally }: { label: string; tally: Tally }) => {
  const meanGap = tally.gaps.reduce((s, g) => s + g, 0) / tally.gaps.length
  return [
    label.padEnd(22),
    `uneven ${String(tally.uneven).padStart(3)}/${tally.courts} (${pct(tally.uneven, tally.courts)})`,
    `avoidable ${String(Math.max(0, tally.uneven - tally.floor)).padStart(3)}`,
    `floor ${String(tally.floor).padStart(3)}`,
    `FF-team courts ${String(tally.ffTeamCourts).padStart(3)}`,
    `lone repeats ${String(tally.loneRepeats).padStart(3)}`,
    `gap mean ${meanGap.toFixed(2)} p90 ${percentile(tally.gaps, 0.9).toFixed(2)} max ${Math.max(...tally.gaps).toFixed(2)}`,
    `${(tally.ms / tally.runs).toFixed(0)}ms/run`,
  ].join(' | ')
}

const main = () => {
  const options = parseArgs(process.argv.slice(2))
  console.log(
    `preset=${options.preset} seeds=${options.seeds} rounds=${options.rounds} weights=${JSON.stringify(options.weights ?? 'default')}`,
  )
  for (const testCase of buildCases(options)) {
    console.log(formatRow({ label: testCase.label, tally: runCase({ testCase, options }) }))
  }
}

main()
