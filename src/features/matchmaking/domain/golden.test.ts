import { describe, it, expect } from 'vitest'
import { generateSchedule } from './generate'
import { mkRoster } from './testkit'
import type { GenerateInput, MatchPreset, ScheduleRun } from './types'

// M2.10 golden suite (D-012): committed vitest snapshots pin the full
// ScheduleRun for 3 rosters × 3 presets. A snapshot diff means behavior
// drift — PLAN §2 requires the PR to explain why the change is intended.
//
// D-034: the 9 run snapshots serialize player *ids* at court/sitter slots
// instead of inlining PlayerInput objects. Each roster's players and the
// resolved config per preset are pinned once by the fixture snapshot below,
// so nothing is unpinned — the run snapshots carry assignment and score
// signal only.

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

/**
 * Snapshot projection: the ScheduleRun with player refs reduced to ids —
 * courts render as `"a+b vs c+d"`, sitters as an id list. `config` is dropped
 * (the fixture snapshot pins it per roster × preset) and `court.players` is
 * dropped as an exact duplicate of the flattened teams, asserted below.
 * Everything a behavior change can move — assignment, teamSums, courtSpread,
 * flags, quality, violations, feasibility, seed — survives verbatim.
 */
const projectRun = ({ config: _config, ...run }: ScheduleRun) => ({
  ...run,
  rounds: run.rounds.map((round) => ({
    courts: round.courts.map(({ players: _players, teams, ...court }) => ({
      ...court,
      teams: `${teams[0].join('+')} vs ${teams[1].join('+')}`,
    })),
    sitters: round.sitters.map((p) => p.playerId),
  })),
})

/** Guards the projection's one dropped field: court.players === teams flattened. */
const expectPlayersMirrorTeams = (run: ScheduleRun) => {
  for (const round of run.rounds) {
    for (const court of round.courts) {
      expect(court.players.map((p) => p.playerId)).toEqual([...court.teams[0], ...court.teams[1]])
    }
  }
}

describe('matcher golden runs (M2.10)', () => {
  for (const [name, base] of Object.entries(ROSTERS)) {
    const runs = PRESETS.map((preset) => generateSchedule({ ...base, config: { preset } }))

    it(`${name} fixture`, () => {
      expect({
        input: base,
        resolvedConfigs: Object.fromEntries(PRESETS.map((preset, i) => [preset, runs[i].config])),
      }).toMatchSnapshot()
    })

    PRESETS.forEach((preset, i) => {
      it(`${name} × ${preset}`, () => {
        // D-014 relies on every golden run being violation-free; assert it
        // rather than leaving it as a snapshot diff someone could wave through.
        expect(runs[i].violations).toEqual([])
        expectPlayersMirrorTeams(runs[i])
        expect(projectRun(runs[i])).toMatchSnapshot()
      })
    })
  }
})
