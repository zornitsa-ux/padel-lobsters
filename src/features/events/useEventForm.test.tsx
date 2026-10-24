// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { NormalisedTournament } from '../../lib/normalise'

const m = vi.hoisted(() => ({ update: vi.fn(), add: vi.fn() }))

vi.mock('./useTournaments', () => ({
  useUpdateTournament: () => ({ mutateAsync: m.update }),
  useAddTournament: () => ({ mutateAsync: m.add }),
}))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({ data: [], isPending: false }),
}))

import { useEventForm } from './useEventForm'

const kotc = {
  id: 't1',
  name: 'King Sunday',
  format: 'king_of_court',
  entryMode: 'team',
  maxPlayers: 20,
  totalPrice: 200,
  courts: [{ name: 'A', booked: false }],
} as unknown as NormalisedTournament

const editAsAmericano = () => {
  const hook = renderHook(() => useEventForm())
  act(() => hook.result.current.openEdit(kotc))
  act(() =>
    hook.result.current.modalProps.setForm((f) => ({
      ...f,
      format: 'lobster_matching',
      entryMode: 'individual',
    })),
  )
  return hook
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useEventForm', () => {
  it('saves an edit and closes', async () => {
    m.update.mockResolvedValue(undefined)
    const { result } = renderHook(() => useEventForm())
    act(() => result.current.openEdit(kotc))

    let outcome
    await act(async () => {
      outcome = await result.current.save()
    })

    expect(outcome).toBe('saved')
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }))
    expect(result.current.modalProps.open).toBe(false)
  })

  it('puts the saved format back and locks the picker when the server refuses it', async () => {
    m.update.mockRejectedValue({ message: 'entry_mode_locked' })
    const { result } = editAsAmericano()

    let outcome
    await act(async () => {
      outcome = await result.current.save()
    })

    expect(outcome).toBe('format_reverted')
    expect(result.current.modalProps.form.format).toBe('king_of_court')
    expect(result.current.modalProps.formatLocked).toBe(true)
    expect(result.current.modalProps.open).toBe(true)
  })

  it('throws any other failure for the caller to show', async () => {
    m.update.mockRejectedValue(new Error('boom'))
    const { result } = editAsAmericano()

    await act(async () => {
      await expect(result.current.save()).rejects.toThrow('boom')
    })
  })
})
