import { describe, it, expect } from 'vitest'
import { runOfShowSteps, runOfShowProgress, votingTurnout } from './runOfShowSteps'
import type { RunOfShowInput, RunOfShowStepId, RunOfShowStepState } from './runOfShowSteps'
import type { PhaseMatch } from './eventPhase'
import type { OscarsPhase } from '../oscars/oscarsPhase'

const scored = (): PhaseMatch => ({ completed: true, score1: 6, score2: 3 })
const unscored = (): PhaseMatch => ({ completed: false, score1: null, score2: null })

const base: RunOfShowInput = {
  tournament: { status: 'active', resultsSharedAt: null, rafflePublishedAt: null },
  matches: [scored(), scored()],
  oscarsPhase: 'not_created',
  flaggedCount: 0,
  hasRaffleWinners: false,
  turnout: null,
}

const build = (overrides: Partial<RunOfShowInput> = {}) => runOfShowSteps({ ...base, ...overrides })

const stateOf = (id: RunOfShowStepId, overrides: Partial<RunOfShowInput> = {}) =>
  build(overrides).find((s) => s.id === id)!.state

const stepOf = (id: RunOfShowStepId, overrides: Partial<RunOfShowInput> = {}) =>
  build(overrides).find((s) => s.id === id)!

// The three tournament stages the sequence walks through.
const SEALED: Partial<RunOfShowInput> = {
  tournament: { status: 'active', resultsSharedAt: null, rafflePublishedAt: null },
}
const COMPLETED: Partial<RunOfShowInput> = {
  tournament: { status: 'completed', resultsSharedAt: null, rafflePublishedAt: null },
}
const REVEALED: Partial<RunOfShowInput> = {
  tournament: {
    status: 'completed',
    resultsSharedAt: '2026-07-29T21:00:00Z',
    rafflePublishedAt: null,
  },
}

describe('runOfShowSteps — shape', () => {
  it('is the eight steps of §04, in order', () => {
    expect(build().map((s) => s.id)).toEqual([
      'enter_scores',
      'finish',
      'resolve_flags',
      'open_voting',
      'close_voting',
      'reveal',
      'draw_raffle',
      'publish_raffle',
    ])
  })

  it('gives every step a state, a detail and a players-see line', () => {
    for (const step of build()) {
      expect(step.detail.length).toBeGreaterThan(0)
      expect(step.playersSee.length).toBeGreaterThan(0)
      expect(['done', 'available', 'locked']).toContain(step.state)
    }
  })

  it('explains every lock, and only locks', () => {
    const steps = build({ matches: [unscored()] })
    for (const step of steps) {
      if (step.state === 'locked') expect(step.lockedReason).toBeTruthy()
      else expect(step.lockedReason).toBeUndefined()
    }
  })
})

describe('D-029 — reveal is independent of rating review', () => {
  it('DEFECT GUARD — reveal is available with a full unresolved flag queue', () => {
    expect(stateOf('reveal', { ...COMPLETED, flaggedCount: 7 })).toBe('available')
  })

  it('reveal is available whether flags are resolved or not', () => {
    for (const flaggedCount of [0, 1, 12]) {
      expect(stateOf('reveal', { ...COMPLETED, flaggedCount })).toBe('available')
    }
  })

  it('no unresolved flag count can ever lock the reveal', () => {
    for (const flaggedCount of [0, 3, 99]) {
      expect(stepOf('reveal', { ...COMPLETED, flaggedCount }).lockedReason).toBeUndefined()
    }
  })

  it('resolving flags stays optional so it blocks nothing', () => {
    expect(stepOf('resolve_flags', { ...COMPLETED, flaggedCount: 4 }).optional).toBe(true)
  })

  it('reveal does not require voting to be closed either', () => {
    for (const oscarsPhase of ['not_created', 'pre_start', 'active'] as OscarsPhase[]) {
      expect(stateOf('reveal', { ...COMPLETED, oscarsPhase })).toBe('available')
    }
  })

  it('reveal folds in Oscars winners when voting has closed, and says so', () => {
    expect(stepOf('reveal', { ...COMPLETED, oscarsPhase: 'ended' }).detail).toContain('Oscars')
    expect(stepOf('reveal', { ...COMPLETED, oscarsPhase: 'active' }).detail).not.toContain('Oscars')
  })

  it('reveal locks only on the one thing the data actually requires', () => {
    expect(stateOf('reveal', SEALED)).toBe('locked')
    expect(stepOf('reveal', SEALED).lockedReason).toBe('Finish the tournament first')
  })

  it('reveal is done once shared', () => {
    expect(stateOf('reveal', { ...REVEALED, flaggedCount: 5 })).toBe('done')
  })
})

describe('Oscars steps never read tournament status', () => {
  const tournamentStates = [SEALED, COMPLETED, REVEALED]

  it('DEFECT GUARD — open_voting is unaffected by tournament status', () => {
    for (const t of tournamentStates) {
      expect(stateOf('open_voting', { ...t, oscarsPhase: 'not_created' })).toBe('available')
      expect(stateOf('open_voting', { ...t, oscarsPhase: 'active' })).toBe('done')
    }
  })

  it('DEFECT GUARD — close_voting is unaffected by tournament status', () => {
    for (const t of tournamentStates) {
      expect(stateOf('close_voting', { ...t, oscarsPhase: 'active' })).toBe('available')
      expect(stateOf('close_voting', { ...t, oscarsPhase: 'ended' })).toBe('done')
    }
  })

  it('voting can open before the tournament is even finished', () => {
    expect(stateOf('open_voting', { ...SEALED, oscarsPhase: 'pre_start' })).toBe('available')
  })
})

describe('open_voting / close_voting gating', () => {
  const openTable: Array<[OscarsPhase, RunOfShowStepState]> = [
    ['loading', 'locked'],
    ['not_created', 'available'],
    ['pre_start', 'available'],
    ['active', 'done'],
    ['ended', 'done'],
    ['shared', 'done'],
  ]

  it.each(openTable)('open_voting at oscars=%s → %s', (oscarsPhase, expected) => {
    expect(stateOf('open_voting', { oscarsPhase })).toBe(expected)
  })

  const closeTable: Array<[OscarsPhase, RunOfShowStepState]> = [
    ['loading', 'locked'],
    ['not_created', 'locked'],
    ['pre_start', 'locked'],
    ['active', 'available'],
    ['ended', 'done'],
    ['shared', 'done'],
  ]

  it.each(closeTable)('close_voting at oscars=%s → %s', (oscarsPhase, expected) => {
    expect(stateOf('close_voting', { oscarsPhase })).toBe(expected)
  })

  it('the one gate that IS a genuine data requirement: cannot close what never opened', () => {
    expect(stepOf('close_voting', { oscarsPhase: 'not_created' }).lockedReason).toBe(
      'Voting has not opened yet',
    )
  })

  it('shows live turnout beside Close voting', () => {
    expect(
      stepOf('close_voting', { oscarsPhase: 'active', turnout: { voted: 22, total: 24 } }).detail,
    ).toBe('22 of 24 players voted')
  })
})

describe('enter_scores and finish', () => {
  it('reports scoring progress rather than offering a button', () => {
    expect(stepOf('enter_scores', { matches: [scored(), unscored(), unscored()] }).detail).toBe(
      '1 of 3 matches scored',
    )
  })

  it('says so when there is no schedule at all', () => {
    expect(stepOf('enter_scores', { matches: [] }).detail).toBe('No schedule yet')
  })

  it('is done once every match is scored', () => {
    expect(stateOf('enter_scores', { matches: [scored(), scored()] })).toBe('done')
    expect(stateOf('enter_scores', { matches: [scored(), unscored()] })).toBe('available')
  })

  it('locks finish until every match is scored', () => {
    expect(stateOf('finish', { matches: [scored(), unscored()] })).toBe('locked')
    expect(stepOf('finish', { matches: [scored(), unscored()] }).lockedReason).toBe(
      'Every match needs a score',
    )
  })

  it('unlocks finish when all scored and not yet completed', () => {
    expect(stateOf('finish', SEALED)).toBe('available')
  })

  it('is done once completed', () => {
    expect(stateOf('finish', COMPLETED)).toBe('done')
  })

  it('an empty schedule does not unlock finish', () => {
    expect(stateOf('finish', { matches: [] })).toBe('locked')
  })

  it('never promises standings to players before the reveal', () => {
    expect(stepOf('finish', SEALED).playersSee).toBe('Standings stay hidden')
  })
})

describe('resolve_flags', () => {
  it('locks before completion, since ratings are applied by Finish', () => {
    expect(stateOf('resolve_flags', { ...SEALED, flaggedCount: 3 })).toBe('locked')
  })

  it('is available with a queue once completed', () => {
    expect(stateOf('resolve_flags', { ...COMPLETED, flaggedCount: 3 })).toBe('available')
    expect(stepOf('resolve_flags', { ...COMPLETED, flaggedCount: 3 }).detail).toBe(
      '3 ratings to review',
    )
  })

  it('singularises a queue of one', () => {
    expect(stepOf('resolve_flags', { ...COMPLETED, flaggedCount: 1 }).detail).toBe(
      '1 rating to review',
    )
  })

  it('is done with an empty queue', () => {
    expect(stateOf('resolve_flags', { ...COMPLETED, flaggedCount: 0 })).toBe('done')
  })
})

describe('draw_raffle and publish_raffle', () => {
  it('draw is available until winners exist, then done', () => {
    expect(stateOf('draw_raffle', { hasRaffleWinners: false })).toBe('available')
    expect(stateOf('draw_raffle', { hasRaffleWinners: true })).toBe('done')
  })

  it('publish locks until the draw has happened', () => {
    expect(stateOf('publish_raffle', { hasRaffleWinners: false })).toBe('locked')
    expect(stepOf('publish_raffle', { hasRaffleWinners: false }).lockedReason).toBe(
      'Draw the raffle first',
    )
  })

  it('publish is available once drawn, and done once published', () => {
    expect(stateOf('publish_raffle', { hasRaffleWinners: true })).toBe('available')
    expect(
      stateOf('publish_raffle', {
        hasRaffleWinners: true,
        tournament: {
          status: 'completed',
          resultsSharedAt: '2026-07-29T21:00:00Z',
          rafflePublishedAt: '2026-07-29T21:30:00Z',
        },
      }),
    ).toBe('done')
  })

  it('keeps a drawn-but-unpublished raffle hidden from players', () => {
    expect(stepOf('draw_raffle', { hasRaffleWinners: true }).playersSee).toContain('not published')
  })

  it('is independent of the standings reveal in both directions', () => {
    // Publish before reveal, and reveal before publish, are both reachable.
    expect(stateOf('publish_raffle', { ...SEALED, hasRaffleWinners: true })).toBe('available')
    expect(stateOf('reveal', { ...COMPLETED, hasRaffleWinners: false })).toBe('available')
  })
})

describe('runOfShowProgress', () => {
  it('counts only required steps', () => {
    const steps = build({
      ...REVEALED,
      matches: [scored()],
      hasRaffleWinners: true,
      flaggedCount: 4,
    })
    const { total } = runOfShowProgress(steps)
    expect(total).toBe(7) // eight steps, minus the optional flag review
  })

  it('reports all done when the whole sequence has run', () => {
    const steps = build({
      tournament: {
        status: 'completed',
        resultsSharedAt: '2026-07-29T21:00:00Z',
        rafflePublishedAt: '2026-07-29T21:30:00Z',
      },
      matches: [scored()],
      oscarsPhase: 'shared',
      flaggedCount: 0,
      hasRaffleWinners: true,
    })
    expect(runOfShowProgress(steps).allDone).toBe(true)
  })

  it('an unresolved flag queue does not stop the sequence reading as complete', () => {
    const steps = build({
      tournament: {
        status: 'completed',
        resultsSharedAt: '2026-07-29T21:00:00Z',
        rafflePublishedAt: '2026-07-29T21:30:00Z',
      },
      matches: [scored()],
      oscarsPhase: 'shared',
      flaggedCount: 6,
      hasRaffleWinners: true,
    })
    expect(runOfShowProgress(steps).allDone).toBe(true)
  })
})

describe('votingTurnout', () => {
  it('is null with no categories', () => {
    expect(votingTurnout([])).toBeNull()
  })

  it('uses the best-attended category as the lower bound on voters', () => {
    expect(
      votingTurnout([
        { votes_count: 18, total_participants: 24 },
        { votes_count: 22, total_participants: 24 },
        { votes_count: 20, total_participants: 24 },
      ]),
    ).toEqual({ voted: 22, total: 24 })
  })

  it('handles a session where nobody has voted yet', () => {
    expect(votingTurnout([{ votes_count: 0, total_participants: 24 }])).toEqual({
      voted: 0,
      total: 24,
    })
  })
})
