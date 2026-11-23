// Stands in for src/features/levelling/useMyLevelling in screen tests that mock their
// data hooks:
//   vi.mock('<path>/levelling/useMyLevelling', () => import('<path>/test/levellingMock'))
// Flip `levellingState.needsLevelling` in a test to show the levelling card, or
// `questionsOpen` for the five-questions prompt.
import { vi } from 'vitest'

export const levellingState = {
  needsLevelling: false,
  questionsOpen: false,
  existing: false,
}

export const refreshLevelling = vi.fn()
export const completeLevelling = vi.fn()
export const dismissQuestions = vi.fn()

export function resetLevellingMock() {
  levellingState.needsLevelling = false
  levellingState.questionsOpen = false
  levellingState.existing = false
  refreshLevelling.mockClear()
  dismissQuestions.mockClear()
  completeLevelling.mockReset()
}

export const useIsExistingPlayer = () => levellingState.existing
export const useNeedsLevelling = () => ({ ...levellingState })
export const useQuestionsPrompt = () => ({
  open: levellingState.questionsOpen,
  dismiss: dismissQuestions,
})
export const useRefreshLevelling = () => refreshLevelling
export const useMyLevelling = () => ({ data: { ...levellingState }, isError: false })
export const useCompleteLevelling = () => ({ mutateAsync: completeLevelling, isPending: false })
