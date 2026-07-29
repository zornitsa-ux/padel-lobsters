import { describe, expect, it } from 'vitest'
import validateSchedule from './validateSchedule'
import type {
  ScheduleMatch,
  SchedulePlayer,
  ScheduleRound,
  ScheduleWarning,
} from './schedule/types'

// ─── Factories ────────────────────────────────────────────────────────────────

const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

// Names are `<id> Lastname` so getName() (first word) returns the id — warning
// messages then read as the player ids used in each fixture.
const makePlayers = (
  playerIds: string[],
  overrides: Record<string, Partial<SchedulePlayer>> = {},
): SchedulePlayer[] =>
  playerIds.map((id) => ({
    id,
    name: `${id} Lastname`,
    gender: 'male',
    isLeftHanded: false,
    ...(overrides[id] || {}),
  }))

const match = (court: string, team1Ids: string[], team2Ids: string[]): ScheduleMatch => ({
  court,
  team1Ids,
  team2Ids,
})

// `matches` is deliberately allowed to be undefined: validateSchedule guards
// `r.matches || []` and one case below pins that.
const round = (
  n: number,
  matches: ScheduleMatch[] | undefined,
  extra: Partial<ScheduleRound> = {},
): ScheduleRound => ({ round: n, label: `Round ${n}`, matches, ...extra }) as ScheduleRound

const shape = (warnings: ScheduleWarning[]) =>
  warnings.map(({ type, severity, round: r }) => ({ type, severity, r }))

// ─── Fixtures shared by several cases ─────────────────────────────────────────

const EIGHT_MEN = makePlayers(ids(8))

const FOUR_MEN = makePlayers(ids(4))

// 3 women (p1–p3) + 5 men — an odd split, so one court per round is forced to
// be 1W1M vs 0W2M.
const THREE_WOMEN = makePlayers(ids(8), {
  p1: { gender: 'female' },
  p2: { gender: 'female' },
  p3: { gender: 'female' },
})

// 4 women (p1–p4) + 4 men — an even split, nothing unavoidable.
const FOUR_WOMEN = makePlayers(ids(8), {
  p1: { gender: 'female' },
  p2: { gender: 'female' },
  p3: { gender: 'female' },
  p4: { gender: 'female' },
})

const CLEAN_ROUNDS = [
  round(1, [
    match('Court 1', ['p1', 'p2'], ['p3', 'p4']),
    match('Court 2', ['p5', 'p6'], ['p7', 'p8']),
  ]),
  round(2, [
    match('Court 1', ['p1', 'p3'], ['p2', 'p4']),
    match('Court 2', ['p5', 'p7'], ['p6', 'p8']),
  ]),
]

// p1 and p2 are on opposite sides in all three rounds; every other pairing
// meets at most twice.
const THRICE_FACED_ROUNDS = [
  round(1, [match('Court 1', ['p1', 'p3'], ['p2', 'p4'])], { sitting: ['p5', 'p6'] }),
  round(2, [match('Court 1', ['p1', 'p4'], ['p2', 'p5'])], { sitting: ['p3', 'p6'] }),
  round(3, [match('Court 1', ['p1', 'p5'], ['p2', 'p6'])], { sitting: ['p3', 'p4'] }),
]

// ─── Table ────────────────────────────────────────────────────────────────────

const cases = [
  {
    name: 'empty schedule and empty roster produce no warnings',
    players: [],
    rounds: [],
    genderMode: 'open',
    expected: [],
  },
  {
    name: 'a valid non-mixed schedule produces no warnings',
    players: EIGHT_MEN,
    rounds: CLEAN_ROUNDS,
    genderMode: 'open',
    expected: [],
  },
  {
    name: 'flags registered players left out of a round',
    players: makePlayers(ids(6)),
    rounds: [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])])],
    genderMode: 'open',
    expected: [{ type: 'round-missing-players', severity: 'error', r: 1 }],
  },
  {
    name: 'sitting players are not counted as missing',
    players: makePlayers(ids(6)),
    rounds: [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])], { sitting: ['p5', 'p6'] })],
    genderMode: 'open',
    expected: [],
  },
  {
    name: 'a round with no matches at all reports everyone missing',
    players: FOUR_MEN,
    rounds: [round(1, undefined)],
    genderMode: 'open',
    expected: [{ type: 'round-missing-players', severity: 'error', r: 1 }],
  },
  {
    name: 'flags a player appearing more than once in a round',
    players: FOUR_MEN,
    rounds: [round(1, [match('Court 1', ['p1', 'p1'], ['p3', 'p4'])], { sitting: ['p2'] })],
    genderMode: 'open',
    expected: [{ type: 'round-duplicate-players', severity: 'error', r: 1 }],
  },
  {
    name: 'flags a non-registered player in a round',
    players: FOUR_MEN,
    rounds: [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'pX'])], { sitting: ['p4'] })],
    genderMode: 'open',
    expected: [{ type: 'round-foreign-players', severity: 'error', r: 1 }],
  },
  {
    name: 'flags a repeated partnership on its second occurrence',
    players: FOUR_MEN,
    rounds: [
      round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
      round(2, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
    ],
    genderMode: 'open',
    expected: [
      { type: 'repeat-partner', severity: 'error', r: 2 },
      { type: 'repeat-partner', severity: 'error', r: 2 },
    ],
  },
  {
    name: 'a partnership repeated a third time is not flagged again',
    players: FOUR_MEN,
    rounds: [
      round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
      round(2, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
      round(3, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
    ],
    genderMode: 'open',
    expected: [
      { type: 'repeat-partner', severity: 'error', r: 2 },
      { type: 'repeat-partner', severity: 'error', r: 2 },
      // Rounds 1–3 give every cross-team pair 3 meetings.
      { type: 'repeat-opponent', severity: 'warning', r: 3 },
      { type: 'repeat-opponent', severity: 'warning', r: 3 },
      { type: 'repeat-opponent', severity: 'warning', r: 3 },
      { type: 'repeat-opponent', severity: 'warning', r: 3 },
    ],
  },
  {
    name: 'a one-player team is not treated as a partnership',
    players: makePlayers(['p1', 'p2']),
    rounds: [
      round(1, [match('Court 1', ['p1'], ['p2'])]),
      round(2, [match('Court 1', ['p1'], ['p2'])]),
    ],
    genderMode: 'open',
    expected: [],
  },
  {
    name: 'flags two left-handers on the same team',
    players: makePlayers(ids(4), { p1: { isLeftHanded: true }, p2: { isLeftHanded: true } }),
    rounds: [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])])],
    genderMode: 'open',
    expected: [{ type: 'double-lefty', severity: 'error', r: 1 }],
  },
  {
    name: 'one left-hander per team is fine',
    players: makePlayers(ids(4), { p1: { isLeftHanded: true }, p3: { isLeftHanded: true } }),
    rounds: [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])])],
    genderMode: 'open',
    expected: [],
  },
  {
    name: 'opponents meeting twice are not flagged',
    players: FOUR_MEN,
    rounds: [
      round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
      round(2, [match('Court 1', ['p1', 'p3'], ['p2', 'p4'])]),
    ],
    genderMode: 'open',
    expected: [],
  },
  {
    name: 'flags opponents meeting three times',
    players: makePlayers(ids(6)),
    rounds: THRICE_FACED_ROUNDS,
    genderMode: 'open',
    expected: [{ type: 'repeat-opponent', severity: 'warning', r: 3 }],
  },
  {
    name: 'mixed mode flags an avoidable gender imbalance as an error',
    players: makePlayers(ids(4), { p1: { gender: 'female' }, p2: { gender: 'female' } }),
    rounds: [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])])],
    genderMode: 'mixed',
    expected: [{ type: 'gender-mismatch', severity: 'error', r: 1 }],
  },
  {
    name: 'mixed mode accepts a balanced court',
    players: makePlayers(ids(4), { p1: { gender: 'female' }, p2: { gender: 'female' } }),
    rounds: [round(1, [match('Court 1', ['p1', 'p3'], ['p2', 'p4'])])],
    genderMode: 'mixed',
    expected: [],
  },
  {
    name: 'an odd number of women is reported once, and the forced clash is info',
    players: THREE_WOMEN,
    rounds: [
      round(1, [
        match('Court 1', ['p1', 'p4'], ['p2', 'p5']),
        match('Court 2', ['p3', 'p6'], ['p7', 'p8']),
      ]),
    ],
    genderMode: 'mixed',
    expected: [
      { type: 'gender-odd-women', severity: 'info', r: 0 },
      { type: 'gender-mismatch', severity: 'info', r: 1 },
    ],
  },
  {
    name: 'imbalance beyond the unavoidable quota is still an error',
    players: THREE_WOMEN,
    rounds: [
      round(1, [
        match('Court 1', ['p1', 'p4'], ['p5', 'p6']),
        match('Court 2', ['p2', 'p3'], ['p7', 'p8']),
      ]),
    ],
    genderMode: 'mixed',
    expected: [
      { type: 'gender-odd-women', severity: 'info', r: 0 },
      { type: 'gender-mismatch', severity: 'info', r: 1 },
      { type: 'gender-mismatch', severity: 'error', r: 1 },
    ],
  },
  {
    name: 'summarises all-male and all-female courts per round',
    players: FOUR_WOMEN,
    rounds: [
      round(1, [
        match('Court 1', ['p1', 'p2'], ['p3', 'p4']),
        match('Court 2', ['p5', 'p6'], ['p7', 'p8']),
      ]),
    ],
    genderMode: 'mixed',
    expected: [{ type: 'gender-court-composition', severity: 'info', r: 1 }],
  },
  {
    name: 'an all-male roster in mixed mode reports composition but no odd-women notice',
    players: EIGHT_MEN,
    rounds: [CLEAN_ROUNDS[0]],
    genderMode: 'mixed',
    expected: [{ type: 'gender-court-composition', severity: 'info', r: 1 }],
  },
  {
    name: 'non-mixed mode ignores gender entirely',
    players: FOUR_WOMEN,
    rounds: [
      round(1, [
        match('Court 1', ['p1', 'p2'], ['p3', 'p4']),
        match('Court 2', ['p5', 'p6'], ['p7', 'p8']),
      ]),
    ],
    genderMode: 'open',
    expected: [],
  },
  {
    name: 'an undefined genderMode behaves like non-mixed',
    players: THREE_WOMEN,
    rounds: [
      round(1, [
        match('Court 1', ['p1', 'p4'], ['p2', 'p5']),
        match('Court 2', ['p3', 'p6'], ['p7', 'p8']),
      ]),
    ],
    genderMode: undefined,
    expected: [],
  },
]

describe('validateSchedule', () => {
  it.each(cases)('$name', ({ players, rounds, genderMode, expected }) => {
    expect(shape(validateSchedule(rounds, players, genderMode))).toEqual(expected)
  })
})

// ─── Messages ─────────────────────────────────────────────────────────────────

describe('validateSchedule — messages', () => {
  const messageOf = (
    rounds: ScheduleRound[],
    players: SchedulePlayer[],
    genderMode?: string,
  ): string => validateSchedule(rounds, players, genderMode)[0].message

  it('names the missing players and pluralises', () => {
    const msg = messageOf(
      [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])])],
      makePlayers(ids(6)),
      'open',
    )
    expect(msg).toBe('❌ 2 registered players not scheduled this round: p5, p6')
  })

  it('uses the singular form for a single missing player', () => {
    const msg = messageOf(
      [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])], { sitting: ['p6'] })],
      makePlayers(ids(6)),
      'open',
    )
    expect(msg).toBe('❌ 1 registered player not scheduled this round: p5')
  })

  it('names the duplicated player', () => {
    const msg = messageOf(
      [round(1, [match('Court 1', ['p1', 'p1'], ['p3', 'p4'])], { sitting: ['p2'] })],
      FOUR_MEN,
      'open',
    )
    expect(msg).toBe('⚠️ p1 appears on more than one court this round')
  })

  it('does not name non-registered players', () => {
    const msg = messageOf(
      [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'pX'])], { sitting: ['p4'] })],
      FOUR_MEN,
      'open',
    )
    expect(msg).toBe('❌ Non-registered player in this round')
  })

  it('names both left-handers and the court', () => {
    const msg = messageOf(
      [round(1, [match('1', ['p1', 'p2'], ['p3', 'p4'])])],
      makePlayers(ids(4), { p1: { isLeftHanded: true }, p2: { isLeftHanded: true } }),
      'open',
    )
    expect(msg).toBe('🫲 Two left-handers on Court 1: p1 & p2')
  })

  it('points back at the earlier round for a repeat partnership', () => {
    const warnings = validateSchedule(
      [
        round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
        round(2, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])]),
      ],
      FOUR_MEN,
      'open',
    )
    expect(warnings[0].message).toBe('🔁 p1 & p2 are partners again (also round 1)')
  })

  it('lists every round a repeat opponent pairing occurred in', () => {
    const msg = messageOf(THRICE_FACED_ROUNDS, makePlayers(ids(6)), 'open')
    expect(msg).toBe('👥 p1 & p2 face each other 3 times (rounds 1, 2, 3)')
  })

  it('spells out both team compositions for a gender imbalance', () => {
    const msg = messageOf(
      [round(1, [match('Court 1', ['p1', 'p2'], ['p3', 'p4'])])],
      makePlayers(ids(4), { p1: { gender: 'female' }, p2: { gender: 'female' } }),
      'mixed',
    )
    expect(msg).toBe('⚥ Gender imbalance on Court 1: p1+p2 (2W0M) vs p3+p4 (0W2M)')
  })

  it('explains an unavoidable imbalance instead of blaming the schedule', () => {
    const warnings = validateSchedule(
      [
        round(1, [
          match('Court 1', ['p1', 'p4'], ['p2', 'p5']),
          match('Court 2', ['p3', 'p6'], ['p7', 'p8']),
        ]),
      ],
      THREE_WOMEN,
      'mixed',
    )
    expect(warnings[0].message).toContain('Odd number of women (3)')
    expect(warnings[0].message).toContain('3W + 5M')
    expect(warnings[1].message).toBe(
      'Court 2: p3+p6 (1W1M) vs p7+p8 (0W2M) — unavoidable with 3 women',
    )
  })

  it('summarises men-only and ladies-only courts', () => {
    const msg = messageOf(
      [
        round(1, [
          match('Court 1', ['p1', 'p2'], ['p3', 'p4']),
          match('Court 2', ['p5', 'p6'], ['p7', 'p8']),
        ]),
      ],
      FOUR_WOMEN,
      'mixed',
    )
    expect(msg).toBe('R1: 1/2 Men · 1/2 Ladies')
  })
})
