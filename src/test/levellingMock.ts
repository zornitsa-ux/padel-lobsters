// Stands in for src/features/levelling/useMyLevelling in screen tests that mock their
// data hooks:
//   vi.mock('<path>/levelling/useMyLevelling', () => import('<path>/test/levellingMock'))
// Flip `levellingState.needsLevelling` in a test to show the levelling card.
import { vi } from 'vitest'

export const levellingState = {
  needsLevelling: false,
  levelOnFile: null as number | null,
  existing: false,
}

export const refreshLevelling = vi.fn()
export const completeLevelling = vi.fn()

export function resetLevellingMock() {
  levellingState.needsLevelling = false
  levellingState.levelOnFile = null
  levellingState.existing = false
  refreshLevelling.mockClear()
  completeLevelling.mockReset()
}

export const useIsExistingPlayer = () => levellingState.existing
export const useNeedsLevelling = () => ({ ...levellingState })
export const useRefreshLevelling = () => refreshLevelling
export const useMyLevelling = () => ({ data: { ...levellingState }, isError: false })
export const useCompleteLevelling = () => ({ mutateAsync: completeLevelling, isPending: false })
