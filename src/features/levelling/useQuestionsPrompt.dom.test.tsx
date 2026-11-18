// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  userId: 'player-1' as string | null,
  questionsOpen: true,
}))

vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: m.userId ? { user: { id: m.userId } } : null }),
}))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: () => ({
    data: { needsLevelling: false, levelOnFile: 2.3, questionsOpen: m.questionsOpen },
  }),
}))

import { useQuestionsPrompt } from './useMyLevelling'

beforeEach(() => {
  localStorage.clear()
  m.userId = 'player-1'
  m.questionsOpen = true
})

describe('useQuestionsPrompt', () => {
  it('is open while the questions are, until Not now', () => {
    const { result } = renderHook(() => useQuestionsPrompt())
    expect(result.current.open).toBe(true)
    act(() => result.current.dismiss())
    expect(result.current.open).toBe(false)
  })

  it('stays dismissed on this device, for this player only', () => {
    renderHook(() => useQuestionsPrompt()).result.current.dismiss()
    expect(renderHook(() => useQuestionsPrompt()).result.current.open).toBe(false)
    m.userId = 'player-2'
    expect(renderHook(() => useQuestionsPrompt()).result.current.open).toBe(true)
  })

  it('is closed once answered', () => {
    m.questionsOpen = false
    expect(renderHook(() => useQuestionsPrompt()).result.current.open).toBe(false)
  })
})
