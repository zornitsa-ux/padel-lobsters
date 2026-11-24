import { describe, expect, it } from 'vitest'
import {
  buildPlan,
  checkVerified,
  ciVerdict,
  isEmptyPlan,
  parseFunctionList,
  parseMigrationList,
  staleFunctions,
  toEpochSeconds,
} from './plan.ts'

describe('parseMigrationList', () => {
  it('finds rows in the envelope and treats blanks as missing', () => {
    const json = {
      target: {},
      migrations: [
        { local: '1', remote: '1' },
        { local: '2', remote: '' },
        { remote: '0', local: null },
      ],
    }
    expect(parseMigrationList({ json })).toEqual([
      { local: '1', remote: '1' },
      { local: '2', remote: null },
      { local: null, remote: '0' },
    ])
  })
})

describe('toEpochSeconds', () => {
  it('reads ISO strings, seconds and milliseconds', () => {
    expect(toEpochSeconds({ value: '2026-11-24T10:00:00Z' })).toBe(1795514400)
    expect(toEpochSeconds({ value: 1795514400 })).toBe(1795514400)
    expect(toEpochSeconds({ value: 1795514400123 })).toBe(1795514400)
    expect(toEpochSeconds({ value: 'nope' })).toBeNull()
  })
})

describe('parseFunctionList', () => {
  it('accepts slug or name, wrapped or bare', () => {
    const rows = [
      { slug: 'a', updated_at: 1795514400000 },
      { name: 'b', updatedAt: '2026-11-24T10:00:00Z' },
    ]
    expect(parseFunctionList({ json: { functions: rows } })).toEqual([
      { name: 'a', updatedAt: 1795514400 },
      { name: 'b', updatedAt: 1795514400 },
    ])
    expect(parseFunctionList({ json: rows })).toHaveLength(2)
  })

  it('refuses a function whose timestamp it cannot read', () => {
    expect(() => parseFunctionList({ json: [{ slug: 'a', updated_at: 'garbage' }] })).toThrow(
      /updated_at/,
    )
  })
})

describe('staleFunctions', () => {
  const local = [
    { name: 'a', committedAt: 100 },
    { name: 'b', committedAt: 100 },
    { name: 'c', committedAt: 100 },
  ]
  const remote = [
    { name: 'a', updatedAt: 200 },
    { name: 'b', updatedAt: 50 },
  ]

  it('flags a function committed after its deploy, or never deployed', () => {
    expect(staleFunctions({ local, remote, force: false })).toEqual(['b', 'c'])
  })

  it('redeploys everything when forced', () => {
    expect(staleFunctions({ local, remote, force: true })).toEqual(['a', 'b', 'c'])
  })
})

describe('buildPlan and checkVerified', () => {
  const migrations = [
    { local: '1', remote: '1' },
    { local: '2', remote: null },
  ]

  it('plans pending migrations and stale functions', () => {
    const plan = buildPlan({
      migrations,
      localFunctions: [{ name: 'f', committedAt: 10 }],
      remoteFunctions: [{ name: 'f', updatedAt: 5 }],
      forceFunctions: false,
    })
    expect(plan).toEqual({
      pendingMigrations: ['2'],
      remoteOnlyMigrations: [],
      staleFunctions: ['f'],
    })
    expect(isEmptyPlan({ plan })).toBe(false)
  })

  it('is empty when production is current', () => {
    const plan = buildPlan({
      migrations: [{ local: '1', remote: '1' }],
      localFunctions: [{ name: 'f', committedAt: 5 }],
      remoteFunctions: [{ name: 'f', updatedAt: 10 }],
      forceFunctions: false,
    })
    expect(isEmptyPlan({ plan })).toBe(true)
  })

  it('verification reports pending, remote-only and stale', () => {
    const problems = checkVerified({
      migrations: [
        { local: '2', remote: null },
        { local: null, remote: '9' },
      ],
      localFunctions: [{ name: 'f', committedAt: 10 }],
      remoteFunctions: [{ name: 'f', updatedAt: 5 }],
    })
    expect(problems).toHaveLength(3)
  })
})

describe('ciVerdict', () => {
  const run = (name: string, status: string, conclusion: string) => ({ name, status, conclusion })

  it('needs at least one run', () => {
    expect(ciVerdict({ runs: [] }).ok).toBe(false)
  })

  it('waits for runs in progress', () => {
    expect(
      ciVerdict({ runs: [run('CI', 'in_progress', ''), run('DB types', 'completed', 'success')] }),
    ).toMatchObject({
      ok: false,
      reason: expect.stringContaining('CI'),
    })
  })

  it('fails on a red run', () => {
    expect(ciVerdict({ runs: [run('CI', 'completed', 'failure')] }).ok).toBe(false)
  })

  it('lets a newer passing re-run supersede an older failure (newest first)', () => {
    expect(
      ciVerdict({ runs: [run('CI', 'completed', 'success'), run('CI', 'completed', 'failure')] })
        .ok,
    ).toBe(true)
  })
})
