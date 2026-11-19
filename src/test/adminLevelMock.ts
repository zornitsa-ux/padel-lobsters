// Stands in for the admin level hooks (S6b) in screen tests that mock their data hooks:
//   vi.mock('<path>/levelling/useAdminLevelCheck', () => import('<path>/test/adminLevelMock'))
//   vi.mock('<path>/registration/useSaveLevels', () => import('<path>/test/adminLevelMock'))
// The check is the real rule; add ids to `levelledIds` for players with a levelling start.
import { vi } from 'vitest'
import { hasNoLevel } from '../features/levelling/levelRules'
import type { Player } from '../lib/normalise'

export const levelledIds = new Set<string>()
export const saveLevels = vi.fn(async () => true)

export function resetAdminLevelMock() {
  levelledIds.clear()
  saveLevels.mockReset()
  saveLevels.mockResolvedValue(true)
}

export const useAdminLevelCheck = () => (player: Player | null | undefined) =>
  !!player && hasNoLevel({ player, levelledIds })
export const useSaveLevels = () => saveLevels
