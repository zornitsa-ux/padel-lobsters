// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { LevelRefusal } from '../../../lib/level'

const m = vi.hoisted(() => ({ updatePlayer: vi.fn(), showToast: vi.fn() }))

vi.mock('../../../context/useApp', () => ({ useApp: () => ({ session: null, role: 'admin' }) }))
vi.mock('../../players/usePlayers', () => ({
  usePlayerActions: () => ({ updatePlayer: m.updatePlayer }),
}))
vi.mock('../../../lib/toastBus', () => ({ useToast: () => ({ showToast: m.showToast }) }))

import { useSaveLevels } from './useSaveLevels'

const save = (level: string) =>
  renderHook(() => useSaveLevels()).result.current({
    levels: [{ playerId: 'p1', name: 'Sam', level }],
  })

beforeEach(() => {
  m.updatePlayer.mockReset()
  m.showToast.mockReset()
})

describe('useSaveLevels', () => {
  it('says why the database refused the level', async () => {
    m.updatePlayer.mockRejectedValue(new LevelRefusal('Playtomic level must be … 2 decimals.'))
    expect(await save('2.455')).toBe(false)
    expect(m.showToast).toHaveBeenCalledWith({
      variant: 'error',
      message:
        "Couldn't save Sam's level, so nobody was registered. Playtomic level must be … 2 decimals.",
    })
  })

  it('keeps other failures generic', async () => {
    m.updatePlayer.mockRejectedValue(new Error('network down'))
    expect(await save('2.5')).toBe(false)
    expect(m.showToast).toHaveBeenCalledWith({
      variant: 'error',
      message: "Couldn't save Sam's level, so nobody was registered.",
    })
  })
})
