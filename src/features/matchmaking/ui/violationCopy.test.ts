import { describe, expect, it } from 'vitest'
import { violationsSummary } from './violationCopy'

const names = { 'id-a': 'Dana', 'id-b': 'Sam' }

describe('violationsSummary', () => {
  it('is null when there are no violations', () => {
    expect(violationsSummary({ violations: [], names })).toBeNull()
  })

  it('phrases rules in padel terms with player names', () => {
    const summary = violationsSummary({
      names,
      violations: [
        {
          round: 3,
          court: 1,
          rule: 'partner-repeat',
          reason: 'id-a and id-b partner for the 2nd time',
        },
        { round: 4, court: 2, rule: 'lefty', reason: 'id-b and id-a are both left-handed' },
      ],
    })
    expect(summary).toBe(
      '2 rule breaks: Round 3, Court 1 — Dana & Sam partner again; Round 4, Court 2 — Two left-handers on one team (Sam & Dana)',
    )
  })

  it('keeps sit-outs plain, substituting names', () => {
    const violation = {
      round: 2,
      court: null,
      rule: 'sit-outs',
      reason: 'id-a sits out in consecutive rounds',
    }
    expect(violationsSummary({ names, violations: [violation] })).toBe(
      '1 rule break: Round 2 — Dana sits out in consecutive rounds',
    )
  })
})
