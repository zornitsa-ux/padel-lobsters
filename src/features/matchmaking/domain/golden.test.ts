import { describe, it, expect } from 'vitest'
import { generateSchedule } from './generate'
import { mkRoster } from './testkit'
import type { GenerateInput, MatchPreset } from './types'

// M2.10 golden suite (D-012): committed vitest snapshots pin the full
// ScheduleRun for 3 rosters × 3 presets. A snapshot diff means behavior
// drift — PLAN §2 requires the PR to explain why the change is intended.
// The implementing task removes `.skip` and commits the snapshots.

const ROSTERS: Record<string, Omit<GenerateInput, 'config'>> = {
  'mixed-16': {
    tournamentId: 'golden-mixed-16',
    players: mkRoster({ count: 16, lefties: 4, males: 8, females: 8 }),
    courts: 4,
    rounds: 5,
    genderMode: 'mixed',
  },
  'mixed-21-sitters': {
    tournamentId: 'golden-mixed-21',
    players: mkRoster({ count: 21, lefties: 2, males: 10, females: 9 }),
    courts: 5,
    rounds: 6,
    genderMode: 'mixed',
  },
  'men-32': {
    tournamentId: 'golden-men-32',
    players: mkRoster({ count: 32, lefties: 3, males: 32 }),
    courts: 8,
    rounds: 4,
    genderMode: 'men',
  },
}
const PRESETS: MatchPreset[] = ['competitive', 'balanced', 'social']

describe('matcher golden runs (M2.10)', () => {
  for (const [name, base] of Object.entries(ROSTERS)) {
    for (const preset of PRESETS) {
      it(`${name} × ${preset}`, () => {
        expect(generateSchedule({ ...base, config: { preset } })).toMatchSnapshot()
      })
    }
  }
})
