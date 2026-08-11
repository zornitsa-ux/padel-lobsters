import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { GenerateInput } from './domain/types'
import { mkRoster } from './domain/testkit'
import { mockSupabase } from '../../test/mockSupabase'

const { mockRpc, mockSaveMatches } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockSaveMatches: vi.fn(),
}))

vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc }))
vi.mock('../events/matchQueries', () => ({ saveMatches: mockSaveMatches }))

import {
  commitSchedule,
  fetchMmRatings,
  previewSchedule,
  recordScheduleRun,
  scheduleRunToMatchRows,
  toPlayerInput,
} from './generateSchedule.service'

const baseInput: GenerateInput = {
  tournamentId: 't1',
  players: mkRoster({ count: 8 }),
  courts: 2,
  rounds: 3,
  genderMode: 'mixed',
  config: { preset: 'balanced' },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockRpc.mockResolvedValue({ data: 'run-uuid', error: null })
  mockSaveMatches.mockResolvedValue(undefined)
})

describe('toPlayerInput', () => {
  it('uses mm_* when the player has been rated', () => {
    const result = toPlayerInput({
      playerId: 'p1',
      name: 'Ann',
      playtomicLevel: 3.0,
      mmRating: 4.2,
      mmSigma: 0.31,
      isLeftHanded: true,
      gender: 'female',
    })
    expect(result).toEqual({
      playerId: 'p1',
      name: 'Ann',
      mu: 4.2,
      sigma: 0.31,
      isLeftHanded: true,
      gender: 'female',
    })
  })

  it('falls back to the self-level prior (mu = level, sigma = 0.7) when unrated', () => {
    const result = toPlayerInput({
      playerId: 'p2',
      name: 'Bo',
      playtomicLevel: 3.5,
      mmRating: null,
      mmSigma: null,
      isLeftHanded: false,
      gender: 'male',
    })
    expect(result.mu).toBe(3.5)
    expect(result.sigma).toBe(0.7)
  })

  it("normalizes '' / null / unexpected gender to unknown (D-011)", () => {
    expect(toPlayerInput({ ...raw(), gender: '' }).gender).toBe('unknown')
    expect(toPlayerInput({ ...raw(), gender: null }).gender).toBe('unknown')
    expect(toPlayerInput({ ...raw(), gender: 'nonbinary' }).gender).toBe('unknown')
  })

  const raw = () => ({
    playerId: 'p3',
    name: 'Cy',
    playtomicLevel: 3,
    mmRating: 3,
    mmSigma: 0.3,
    isLeftHanded: false,
    gender: 'x',
  })
})

describe('scheduleRunToMatchRows', () => {
  it('maps a run to 1-based rounds/courts with mu-sum team levels', () => {
    const run = previewSchedule(baseInput)
    const rows = scheduleRunToMatchRows(run)

    expect(rows).toHaveLength(3)
    rows.forEach((round, i) => {
      expect(round).toHaveLength(2)
      round.forEach((m, c) => {
        expect(m.round).toBe(i + 1)
        expect(m.court).toBe(String(c + 1))
        expect(m.team1Ids).toHaveLength(2)
        expect(m.team2Ids).toHaveLength(2)
        expect(typeof m.team1Level).toBe('number')
        expect(typeof m.team2Level).toBe('number')
        expect(m.completed).toBe(false)
      })
    })
  })

  it('is deterministic for the same input', () => {
    expect(scheduleRunToMatchRows(previewSchedule(baseInput))).toEqual(
      scheduleRunToMatchRows(previewSchedule(baseInput)),
    )
  })
})

describe('recordScheduleRun', () => {
  it('calls the RPC with the run payload and returns the id', async () => {
    const run = previewSchedule(baseInput)
    const id = await recordScheduleRun(run)

    expect(id).toBe('run-uuid')
    expect(mockRpc).toHaveBeenCalledWith('admin_record_schedule_run', {
      input_payload: {
        tournament_id: 't1',
        config: run.config,
        seed: run.seed,
        report: run,
      },
    })
  })

  it('throws when the RPC errors', async () => {
    const err = { message: 'not admin' }
    mockRpc.mockResolvedValue({ data: null, error: err })
    await expect(recordScheduleRun(previewSchedule(baseInput))).rejects.toBe(err)
  })
})

describe('commitSchedule', () => {
  it('persists matches before recording the run and returns the run id', async () => {
    const run = previewSchedule(baseInput)
    const result = await commitSchedule({ run })

    expect(result).toEqual({ runId: 'run-uuid' })
    expect(mockSaveMatches).toHaveBeenCalledWith('t1', scheduleRunToMatchRows(run))
    expect(mockSaveMatches.mock.invocationCallOrder[0]).toBeLessThan(
      mockRpc.mock.invocationCallOrder[0],
    )
  })
})

// Regression: mm_* is admin-only and therefore absent from players_public, so
// the learned prior has to arrive via this RPC. When it didn't, the roster's
// mmRating was structurally always null and every event silently re-seeded from
// playtomic_level — ratings were written but never read back.
describe('fetchMmRatings', () => {
  it('keys the learned prior by player id', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { player_id: 'p1', mm_rating: 4.2, mm_sigma: 0.31 },
        { player_id: 'p2', mm_rating: 2.05, mm_sigma: 0.5 },
      ],
      error: null,
    })

    await expect(fetchMmRatings()).resolves.toEqual({
      p1: { mu: 4.2, sigma: 0.31 },
      p2: { mu: 2.05, sigma: 0.5 },
    })
    expect(mockRpc).toHaveBeenCalledWith('admin_get_mm_ratings')
  })

  it('returns an empty map when no player has been rated yet', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    await expect(fetchMmRatings()).resolves.toEqual({})
  })

  it('throws when the admin RPC errors rather than silently falling back', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not admin' } })
    await expect(fetchMmRatings()).rejects.toEqual({ message: 'not admin' })
  })

  it('feeds toPlayerInput a learned prior that overrides playtomic_level', async () => {
    mockRpc.mockResolvedValue({
      data: [{ player_id: 'p1', mm_rating: 4.2, mm_sigma: 0.31 }],
      error: null,
    })
    const learned = await fetchMmRatings()

    const rated = toPlayerInput({
      playerId: 'p1',
      name: 'Ann',
      playtomicLevel: 3.0,
      mmRating: learned.p1?.mu ?? null,
      mmSigma: learned.p1?.sigma ?? null,
      isLeftHanded: false,
      gender: 'female',
    })
    const unrated = toPlayerInput({
      playerId: 'p2',
      name: 'Bo',
      playtomicLevel: 3.0,
      mmRating: learned.p2?.mu ?? null,
      mmSigma: learned.p2?.sigma ?? null,
      isLeftHanded: false,
      gender: 'male',
    })

    expect(rated.mu).toBe(4.2)
    expect(rated.sigma).toBe(0.31)
    expect(unrated.mu).toBe(3.0)
    expect(unrated.mu).not.toBe(rated.mu)
  })
})
