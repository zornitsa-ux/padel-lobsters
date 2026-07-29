// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The avatar upload used to be a direct supabase.storage call inside Settings.
// It now goes through the players slice (useAvatarUpload), so these tests pin
// the contract: stable per-player filename, cache-busted URL, and a failed
// upload that still saves the rest of the profile.
const { uploadMock, updatePlayerMock, processAvatarMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  updatePlayerMock: vi.fn(),
  processAvatarMock: vi.fn(),
}))

const myPlayer = {
  id: 'p1',
  name: 'Ada Lovelace',
  playtomicLevel: 3.5,
  avatarUrl: 'https://cdn.test/old.webp',
  tagline: '',
  taglineLabel: '',
  country: '',
  gender: '',
  preferredPosition: '',
  isLeftHanded: false,
  email: '',
  phone: '',
  birthday: '',
  status: 'active',
  playtomicUsername: '',
}

vi.mock('../players/usePlayers', () => ({
  useMyProfile: () => ({ data: myPlayer }),
  usePlayerActions: () => ({ updatePlayer: updatePlayerMock }),
  useAvatarUpload: () => ({ mutateAsync: uploadMock }),
}))
vi.mock('./useSettings', () => ({
  useSettings: () => ({ data: undefined }),
  useSaveSettings: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('../../context/useApp', () => ({
  useApp: () => ({
    session: { user: { id: 'p1', app_metadata: { role: 'player' } } },
    role: 'player',
    loginWithPin: vi.fn(),
    logout: vi.fn(),
    requestMyEmailChange: vi.fn(),
  }),
}))
// These two own their own query slices and are irrelevant to the upload path.
vi.mock('./AccountStatsSection', () => ({ default: () => null }))
vi.mock('./AccountOrdersSection', () => ({ default: () => null }))
vi.mock('../../components/ApproveDevicesWidget', () => ({ default: () => null }))
vi.mock('../../lib/processAvatar', () => ({ processAvatar: processAvatarMock }))
// Settings imports AdminSection -> AdminSecurityPanels -> useDevices, which
// imports the supabase client module — mock it so import doesn't require
// real env vars (AdminSection itself never renders here since role is 'player').
vi.mock('../../supabase', () => ({ supabase: {} }))

import Settings from './Settings'

const processed = new Blob(['x'], { type: 'image/webp' })

const renderSettings = () =>
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  )

// Expands the profile card and attaches a photo to the (hidden) file input.
const pickAvatar = () => {
  fireEvent.click(screen.getByRole('button', { name: /my lobster profile/i }))
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, {
    target: { files: [new File(['raw'], 'me.png', { type: 'image/png' })] },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  processAvatarMock.mockResolvedValue(processed)
  uploadMock.mockResolvedValue('https://cdn.test/player-p1.webp')
  updatePlayerMock.mockResolvedValue({ ok: true })
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Settings — avatar upload', () => {
  it('uploads the processed blob under a stable per-player filename', async () => {
    renderSettings()
    pickAvatar()

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1))
    expect(uploadMock).toHaveBeenCalledWith({ file: processed, filename: 'player-p1.webp' })
  })

  it('persists the returned URL with a cache buster', async () => {
    renderSettings()
    pickAvatar()

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => expect(updatePlayerMock).toHaveBeenCalledTimes(1))
    const [id, payload] = updatePlayerMock.mock.calls[0]
    expect(id).toBe('p1')
    expect(payload.avatarUrl).toMatch(/^https:\/\/cdn\.test\/player-p1\.webp\?v=\d+$/)
  })

  it('still saves the profile when the upload fails, keeping the old photo', async () => {
    uploadMock.mockRejectedValue(new Error('bucket missing'))
    renderSettings()
    pickAvatar()

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => expect(updatePlayerMock).toHaveBeenCalledTimes(1))
    expect(updatePlayerMock.mock.calls[0][1].avatarUrl).toBe('https://cdn.test/old.webp')
  })

  it('does not upload when no new photo was picked', async () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: /my lobster profile/i }))

    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => expect(updatePlayerMock).toHaveBeenCalledTimes(1))
    expect(uploadMock).not.toHaveBeenCalled()
    expect(processAvatarMock).not.toHaveBeenCalled()
  })
})
