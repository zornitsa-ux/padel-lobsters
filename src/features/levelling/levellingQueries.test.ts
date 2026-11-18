import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc }))

import { completeLevelling, fetchMyLevelling, isNeedsLevel } from './levellingQueries'
import { registerPlayer } from '../events/registrationQueries'
import { respondToTransfer } from '../events/transferQueries'
import { registerTeam, respondToTeamInvite } from '../events/teams/teamQueries'
import type { LevellingPayload } from './levellingFlow'

const gateError = { code: 'P0001', message: 'needs_level', details: '', hint: '' }
const otherError = { code: 'P0001', message: 'something_else', details: '', hint: '' }

const payload: LevellingPayload = {
  years_playing: 'under_1y',
  frequency: 'weekly_1_2',
  lessons: 'none',
  racket_sports: 'casual',
  walls: 'slow_back_wall',
  playtomic_level: null,
  prefilled: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('fetchMyLevelling', () => {
  it('reads a player with no level on file (null, though the generated type says number)', async () => {
    mockRpc.mockResolvedValue({
      data: [{ needs_levelling: true, playtomic_level: null, questions_open: false }],
      error: null,
    })
    await expect(fetchMyLevelling()).resolves.toEqual({
      needsLevelling: true,
      levelOnFile: null,
      questionsOpen: false,
    })
    expect(mockRpc).toHaveBeenCalledWith('get_my_levelling')
  })

  it('reads a player with a level who has the questions open', async () => {
    mockRpc.mockResolvedValue({
      data: [{ needs_levelling: false, playtomic_level: 2.3, questions_open: true }],
      error: null,
    })
    await expect(fetchMyLevelling()).resolves.toEqual({
      needsLevelling: false,
      levelOnFile: 2.3,
      questionsOpen: true,
    })
  })

  it('throws on an error or a malformed row, so the card never shows on a guess', async () => {
    mockRpc.mockResolvedValue({ data: null, error: otherError })
    await expect(fetchMyLevelling()).rejects.toBe(otherError)
    mockRpc.mockResolvedValue({ data: [], error: null })
    await expect(fetchMyLevelling()).rejects.toThrow()
  })

  it('reads the RPC from before S3c as questions closed', async () => {
    mockRpc.mockResolvedValue({
      data: [{ needs_levelling: true, playtomic_level: null }],
      error: null,
    })
    await expect(fetchMyLevelling()).resolves.toMatchObject({
      needsLevelling: true,
      questionsOpen: false,
    })
  })
})

describe('completeLevelling', () => {
  it('sends the payload and returns the status', async () => {
    mockRpc.mockResolvedValue({ data: [{ status: 'ok' }], error: null })
    await expect(completeLevelling({ payload })).resolves.toBe('ok')
    expect(mockRpc).toHaveBeenCalledWith('complete_levelling', { input_answers: payload })
  })

  it('reports error when the call fails or returns nothing', async () => {
    mockRpc.mockResolvedValue({ data: null, error: otherError })
    await expect(completeLevelling({ payload })).resolves.toBe('error')
    mockRpc.mockResolvedValue({ data: [], error: null })
    await expect(completeLevelling({ payload })).resolves.toBe('error')
  })
})

describe('isNeedsLevel', () => {
  it('matches only the gate raise', () => {
    expect(isNeedsLevel({ error: gateError })).toBe(true)
    expect(isNeedsLevel({ error: otherError })).toBe(false)
    expect(isNeedsLevel({ error: { code: '42501', message: 'needs_level' } })).toBe(false)
    expect(isNeedsLevel({ error: null })).toBe(false)
  })
})

describe('the registration paths pass needs_level through (S3 gate)', () => {
  it('registerPlayer, as a returned status and as a raise', async () => {
    mockRpc.mockResolvedValue({
      data: [{ registration_id: null, status: 'needs_level' }],
      error: null,
    })
    await expect(registerPlayer('t1', 'p1')).resolves.toEqual({
      regId: null,
      status: 'needs_level',
    })
    mockRpc.mockResolvedValue({ data: null, error: gateError })
    await expect(registerPlayer('t1', 'p1')).resolves.toEqual({
      regId: null,
      status: 'needs_level',
    })
    mockRpc.mockResolvedValue({ data: null, error: otherError })
    await expect(registerPlayer('t1', 'p1')).resolves.toEqual({ regId: null, status: 'error' })
  })

  it('respondToTransfer, raised by the trigger on acceptance', async () => {
    mockRpc.mockResolvedValue({ data: null, error: gateError })
    await expect(respondToTransfer('x1', true)).resolves.toEqual({
      ok: false,
      status: 'needs_level',
    })
  })

  it('registerTeam, as a returned status and as a raise; other errors still throw', async () => {
    const args = {
      tournamentId: 't1',
      captainId: 'p1',
      choice: { kind: 'member', playerId: 'p2' } as const,
    }
    mockRpc.mockResolvedValue({ data: null, error: gateError })
    await expect(registerTeam(args)).resolves.toMatchObject({ status: 'needs_level' })
    mockRpc.mockResolvedValue({ data: [{ status: 'needs_level', team_id: null }], error: null })
    await expect(registerTeam(args)).resolves.toMatchObject({ status: 'needs_level' })
    mockRpc.mockResolvedValue({ data: null, error: otherError })
    await expect(registerTeam(args)).rejects.toBe(otherError)
  })

  it('respondToTeamInvite, as a raise; other errors still throw', async () => {
    mockRpc.mockResolvedValue({ data: null, error: gateError })
    await expect(respondToTeamInvite({ teamId: 'tm1', accept: true })).resolves.toBe('needs_level')
    mockRpc.mockResolvedValue({ data: null, error: otherError })
    await expect(respondToTeamInvite({ teamId: 'tm1', accept: true })).rejects.toBe(otherError)
  })
})
