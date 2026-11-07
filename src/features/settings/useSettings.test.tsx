// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { waitFor, act } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../test/renderWithClient'
import { settingsKeys } from './settingsKeys'
import { useSettings, useSaveSettings } from './useSettings'

const { mockUseApp } = vi.hoisted(() => ({ mockUseApp: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: mockUseApp }))

vi.mock('./settingsQueries', () => ({
  fetchSettings: vi.fn(),
  saveSettings: vi.fn(),
}))

import { fetchSettings, saveSettings } from './settingsQueries'

const mockSettings = {
  whatsappLink: 'https://wa.me/test',
  groupName: 'Test Group',
  padelTips: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(fetchSettings as ReturnType<typeof vi.fn>).mockResolvedValue(mockSettings)
  ;(saveSettings as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  mockUseApp.mockReturnValue({ session: { user: { id: 'p1' } } })
})

describe('useSettings', () => {
  it('resolves to the data fetchSettings returns', async () => {
    const { result } = renderHookWithClient(() => useSettings())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockSettings)
    expect(fetchSettings).toHaveBeenCalledWith({ signedIn: true })
  })

  it('asks for the guest columns when signed out', async () => {
    mockUseApp.mockReturnValue({ session: null })
    const { result } = renderHookWithClient(() => useSettings())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(fetchSettings).toHaveBeenCalledWith({ signedIn: false })
  })
})

describe('useSaveSettings', () => {
  it('calls saveSettings and invalidates the settings query on success', async () => {
    const client = makeTestQueryClient()
    vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHookWithClient(() => useSaveSettings(), client)

    await act(async () => {
      await result.current.mutateAsync({ whatsappLink: 'https://wa.me/new' })
    })

    const [calledWith] = (saveSettings as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(calledWith).toEqual({ whatsappLink: 'https://wa.me/new' })
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: settingsKeys.all() })
  })
})
