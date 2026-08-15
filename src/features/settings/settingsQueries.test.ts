import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

// Chain helpers hoisted so the vi.mock factory can reference them.
const { mockSingle, mockEq, mockSelect, mockUpsert } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockEq: vi.fn(),
  mockSelect: vi.fn(),
  mockUpsert: vi.fn(),
}))

vi.mock('../../supabase', () =>
  mockSupabase({
    from: vi.fn(() => ({
      select: mockSelect,
      upsert: mockUpsert,
    })),
  }),
)

import { fetchSettings, saveSettings } from './settingsQueries'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockSelect.mockReturnValue({ eq: mockEq })
  mockEq.mockReturnValue({ single: mockSingle })
  mockSingle.mockResolvedValue({ data: null, error: null })
  mockUpsert.mockResolvedValue({ error: null })
})

// ── fetchSettings ────────────────────────────────────────────────────────

describe('fetchSettings', () => {
  it('returns the normalised shape from a raw row', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 1,
        whatsapp_link: 'https://wa.me/test',
        group_name: 'My Group',
        padel_tips: ['tip1', 'tip2'],
      },
      error: null,
    })

    const result = await fetchSettings()

    expect(result).toMatchObject({
      whatsappLink: 'https://wa.me/test',
      groupName: 'My Group',
      padelTips: ['tip1', 'tip2'],
    })
  })

  it('applies defaults when columns are null', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: 1,
        whatsapp_link: null,
        group_name: null,
        padel_tips: null,
      },
      error: null,
    })

    const result = await fetchSettings()

    expect(result).toMatchObject({
      whatsappLink: '',
      groupName: 'Padel Lobsters',
      padelTips: null,
    })
  })

  it('returns null when the row is absent', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })
    expect(await fetchSettings()).toBeNull()
  })

  it('throws when supabase returns an error', async () => {
    const err = { message: 'permission denied', code: '42501' }
    mockSingle.mockResolvedValue({ data: null, error: err })
    await expect(fetchSettings()).rejects.toBe(err)
  })
})

// ── saveSettings ─────────────────────────────────────────────────────────

describe('saveSettings', () => {
  it('upserts the correct payload without padel_tips when padelTips is not provided', async () => {
    await saveSettings({ whatsappLink: 'https://wa.me/x', groupName: 'Lobsters' })

    expect(mockUpsert).toHaveBeenCalledOnce()
    const payload = mockUpsert.mock.calls[0][0]
    expect(payload).toEqual({ id: 1, whatsapp_link: 'https://wa.me/x', group_name: 'Lobsters' })
    expect(payload).not.toHaveProperty('padel_tips')
  })

  it('includes padel_tips in the payload when padelTips is provided', async () => {
    await saveSettings({ padelTips: ['tip1', 'tip2'] })

    const payload = mockUpsert.mock.calls[0][0]
    expect(payload.padel_tips).toEqual(['tip1', 'tip2'])
  })

  it('includes padel_tips: null when padelTips is explicitly null', async () => {
    await saveSettings({ padelTips: null })

    const payload = mockUpsert.mock.calls[0][0]
    expect(payload).toHaveProperty('padel_tips', null)
  })

  it('throws on upsert error and logs to console.error', async () => {
    const err = { message: 'upsert failed' }
    mockUpsert.mockResolvedValue({ error: err })

    await expect(saveSettings({})).rejects.toBe(err)
    expect(console.error).toHaveBeenCalled()
  })
})

// ── Matchmaking V2 rollout flag removed (D-028) ──────────────────────────

describe('the matchmaking rollout flag is gone from the settings slice', () => {
  it('does not request matchmaking_v2_enabled', async () => {
    await fetchSettings()

    const columns = mockSelect.mock.calls[0][0] as string
    expect(columns).toContain('group_name')
    expect(columns).not.toContain('matchmaking_v2_enabled')
  })

  it('does not normalise a flag onto the settings object', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 1, group_name: 'Lobsters', matchmaking_v2_enabled: true },
      error: null,
    })

    // .passthrough() keeps the raw column, but no camelCase flag is derived —
    // nothing in the app reads one any more.
    expect(await fetchSettings()).not.toHaveProperty('matchmakingV2Enabled')
  })

  it('never writes the flag, even if a stale caller passes it', async () => {
    await saveSettings({
      groupName: 'Lobsters',
      matchmakingV2Enabled: true,
    } as Parameters<typeof saveSettings>[0])

    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('matchmaking_v2_enabled')
  })
})
