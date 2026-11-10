// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { SettingsForm } from './settingsHelpers'

const mockSave = vi.fn()
let mockSettings = { whatsappLink: 'https://saved', groupName: 'Saved', padelTips: ['a', 'b'] }
type SectionProps = {
  form: SettingsForm
  setForm: (update: (form: SettingsForm) => SettingsForm) => void
  handleDeleteTip: (index: number) => void
  handleSave: (e: { preventDefault: () => void }) => Promise<void>
}
let section: SectionProps

vi.mock('./useSettings', () => ({
  useSettings: () => ({ data: mockSettings }),
  useSaveSettings: () => ({ mutateAsync: mockSave }),
}))
vi.mock('./AdminSection', () => ({
  default: (props: SectionProps) => {
    section = props
    return <p>{props.form.whatsappLink}</p>
  },
}))

const { default: GroupSettingsPage } = await import('./GroupSettingsPage')

const page = () => (
  <MemoryRouter>
    <GroupSettingsPage />
  </MemoryRouter>
)

const typeLink = () =>
  act(() => section.setForm((form) => ({ ...form, whatsappLink: 'https://half-typed' })))

beforeEach(() => {
  mockSave.mockReset().mockResolvedValue(undefined)
  mockSettings = { whatsappLink: 'https://saved', groupName: 'Saved', padelTips: ['a', 'b'] }
})
afterEach(cleanup)

describe('GroupSettingsPage', () => {
  it('saves only the tips on a tip change, not an unsaved field', async () => {
    render(page())
    typeLink()

    await act(async () => section.handleDeleteTip(0))

    expect(mockSave.mock.calls).toEqual([[{ padelTips: ['b'] }]])
    expect(section.form.whatsappLink).toBe('https://half-typed')
  })

  it('keeps an edit in progress when settings refetch', () => {
    const { rerender } = render(page())
    typeLink()

    mockSettings = { ...mockSettings, whatsappLink: 'https://refetched' }
    rerender(page())

    expect(section.form.whatsappLink).toBe('https://half-typed')
  })

  it('follows the saved settings while untouched', () => {
    const { rerender } = render(page())

    mockSettings = { ...mockSettings, groupName: 'Renamed' }
    rerender(page())

    expect(section.form.groupName).toBe('Renamed')
  })

  it('Save Settings writes the form and leaves the tips alone', async () => {
    render(page())
    typeLink()

    await act(async () => section.handleSave({ preventDefault: () => {} }))

    expect(mockSave.mock.calls).toEqual([
      [{ whatsappLink: 'https://half-typed', groupName: 'Saved' }],
    ])
  })
})
