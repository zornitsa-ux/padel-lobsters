import { describe, it, expect } from 'vitest'
import { auditFeasibility, leftyQuotaForRound, sameGenderQuotaForRound } from './feasibility'
import { mkConfig, mkRoster } from './testkit'
import type { GenderMode, ResolvedConfig } from './types'

const audit = ({
  count,
  courts,
  rounds = 5,
  genderMode = 'men' as GenderMode,
  lefties = 0,
  males = 0,
  females = 0,
  config = mkConfig(),
}: {
  count: number
  courts: number
  rounds?: number
  genderMode?: GenderMode
  lefties?: number
  males?: number
  females?: number
  config?: ResolvedConfig
}) =>
  auditFeasibility({
    players: mkRoster({ count, lefties, males, females }),
    courts,
    rounds,
    genderMode,
    config,
  })

// M2.2 acceptance tests — frozen by M2.1 (docs/matchmaking-v2/PLAN.md).
// The implementing task removes only `.skip`; changing any assertion requires
// a coordinator DECISIONS.md entry.
describe('feasibility (M2.2)', () => {
  describe('sit-out arithmetic', () => {
    it.each([
      [16, 4, 4, 0],
      [18, 4, 4, 2],
      [10, 4, 2, 2],
      [8, 1, 1, 4],
      [7, 1, 1, 3],
    ])(
      '%i players on %i courts ⇒ courtsUsed %i, sitters %i',
      (count, courts, courtsUsed, sitters) => {
        const r = audit({ count, courts })
        expect(r.feasible).toBe(true)
        expect(r.courtsUsed).toBe(courtsUsed)
        expect(r.sittersPerRound).toBe(sitters)
      },
    )

    it('rejects rosters that cannot fill one court', () => {
      const r = audit({ count: 3, courts: 1 })
      expect(r.feasible).toBe(false)
      expect(r.entries.some((e) => e.status === 'infeasible')).toBe(true)
    })

    it('rejects sit-out loads that force consecutive sitting', () => {
      // 20 players on 2 courts: 12 sit each round — more than half the field.
      const r = audit({ count: 20, courts: 2 })
      expect(r.feasible).toBe(false)
      expect(r.entries.some((e) => e.status === 'infeasible')).toBe(true)
    })

    it('accepts the alternating-halves edge case (sitters = half the field)', () => {
      const r = audit({ count: 16, courts: 2 })
      expect(r.feasible).toBe(true)
      expect(r.sittersPerRound).toBe(8)
    })
  })

  describe('lefty quota math', () => {
    it.each([
      [9, 4, 1],
      [3, 4, 0],
      [8, 4, 0],
      [10, 4, 2],
      [4, 1, 2],
      [0, 4, 0],
    ])('%i lefties playing on %i courts ⇒ quota %i', (leftyCount, courtsUsed, quota) => {
      expect(leftyQuotaForRound({ leftyCount, courtsUsed })).toBe(quota)
    })

    it('audits an over-quota lefty roster as relaxed with a readable detail', () => {
      const r = audit({ count: 16, courts: 4, lefties: 9 })
      expect(r.quotas.doubleLeftyTeamsPerRound).toBe(1)
      const entry = r.entries.find((e) => e.rule === 'lefty')
      expect(entry?.status).toBe('relaxed')
      expect(entry?.detail.length).toBeGreaterThan(0)
    })

    it('audits a satisfiable lefty count as ok with quota 0', () => {
      const r = audit({ count: 16, courts: 4, lefties: 3 })
      expect(r.quotas.doubleLeftyTeamsPerRound).toBe(0)
      expect(r.entries.find((e) => e.rule === 'lefty')?.status).toBe('ok')
    })

    it('leftyRule off ⇒ quota 0 and no relaxed lefty entry', () => {
      const r = audit({
        count: 16,
        courts: 4,
        lefties: 9,
        config: mkConfig({ leftyRule: 'off' }),
      })
      expect(r.quotas.doubleLeftyTeamsPerRound).toBe(0)
      expect(r.entries.some((e) => e.rule === 'lefty' && e.status === 'relaxed')).toBe(false)
    })
  })

  describe('gender quota math (D-011)', () => {
    it.each([
      [8, 0, 0, 2, 4],
      [7, 1, 0, 2, 3],
      [6, 2, 0, 2, 2],
      [4, 4, 0, 2, 0],
      [6, 0, 2, 2, 2],
      [3, 0, 5, 2, 0],
      [6, 6, 4, 4, 0],
    ])('M%i F%i U%i on %i courts ⇒ quota %i', (m, f, u, c, quota) => {
      expect(
        sameGenderQuotaForRound({ maleCount: m, femaleCount: f, unknownCount: u, courtsUsed: c }),
      ).toBe(quota)
    })

    it('audits a lopsided mixed-mode roster as relaxed', () => {
      const r = audit({ count: 16, courts: 4, genderMode: 'mixed', males: 12, females: 4 })
      expect(r.quotas.sameGenderTeamsPerRound).toBe(4)
      expect(r.entries.find((e) => e.rule === 'gender')?.status).toBe('relaxed')
    })

    it('audits an even mixed-mode roster as ok', () => {
      const r = audit({ count: 16, courts: 4, genderMode: 'mixed', males: 8, females: 8 })
      expect(r.quotas.sameGenderTeamsPerRound).toBe(0)
      expect(r.entries.find((e) => e.rule === 'gender')?.status).toBe('ok')
    })

    it('unknown genders offset the quota and are reported informationally', () => {
      // 6M + 6F + 4 unknown
      const r = audit({ count: 16, courts: 4, genderMode: 'mixed', males: 6, females: 6 })
      expect(r.quotas.sameGenderTeamsPerRound).toBe(0)
      expect(r.entries.some((e) => e.rule === 'gender-unknown' && e.status === 'ok')).toBe(true)
    })

    it('men mode never blocks on gender, but reports mismatches informationally', () => {
      // 13M + 2F + 1 unknown
      const r = audit({ count: 16, courts: 4, genderMode: 'men', males: 13, females: 2 })
      expect(r.feasible).toBe(true)
      expect(r.entries.find((e) => e.rule === 'gender-mode')?.status).toBe('ok')
    })
  })

  describe('partner-repeat quota', () => {
    it('is zero for fields of 8 or more', () => {
      expect(audit({ count: 8, courts: 2, rounds: 6 }).quotas.partnerRepeatsTotal).toBe(0)
      expect(audit({ count: 16, courts: 4, rounds: 6 }).quotas.partnerRepeatsTotal).toBe(0)
      expect(audit({ count: 32, courts: 8, rounds: 6 }).quotas.partnerRepeatsTotal).toBe(0)
    })

    it('computes the unavoidable repeats for a single court of 4', () => {
      expect(audit({ count: 4, courts: 1, rounds: 3 }).quotas.partnerRepeatsTotal).toBe(0)
      expect(audit({ count: 4, courts: 1, rounds: 5 }).quotas.partnerRepeatsTotal).toBe(4)
    })
  })

  it('every entry carries a human-readable detail', () => {
    const r = audit({
      count: 16,
      courts: 4,
      lefties: 9,
      genderMode: 'mixed',
      males: 12,
      females: 4,
    })
    expect(r.entries.length).toBeGreaterThan(0)
    for (const e of r.entries) expect(e.detail.length).toBeGreaterThan(0)
  })
})
