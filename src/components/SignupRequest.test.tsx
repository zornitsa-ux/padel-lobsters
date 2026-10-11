// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { mockSupabase } from '../test/mockSupabase'

// D-028: the public "Join the Lobsters" form no longer collects a Playtomic
// adjustment. The submit test drives the real form and asserts on what reaches
// selfSignup, which is the payload builder for self_signup_player.
const { mockSelfSignup, mockLoginWithPin, mockSetOwnAvatar, mockPlayers, mockProcessAvatar } =
  vi.hoisted(() => ({
    mockSelfSignup: vi.fn(),
    mockLoginWithPin: vi.fn(),
    mockSetOwnAvatar: vi.fn(),
    mockPlayers: { current: [] as unknown[] },
    mockProcessAvatar: vi.fn(),
  }))

vi.mock('../context/useApp', () => ({
  useApp: () => ({ selfSignup: mockSelfSignup, loginWithPin: mockLoginWithPin }),
}))
vi.mock('../features/players/usePlayers', () => ({
  usePlayers: () => ({ data: mockPlayers.current }),
  usePlayerActions: () => ({ updatePlayer: vi.fn() }),
  useAvatarUpload: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('../supabase', () => mockSupabase({ storage: { from: () => ({}) } }))
vi.mock('../lib/processAvatar', () => ({ processAvatar: mockProcessAvatar }))
vi.mock('../features/players/playerQueries', () => ({
  randomAvatarFilename: () => 'player-random.webp',
  setOwnAvatar: mockSetOwnAvatar,
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

import SignupRequest from './SignupRequest'

const setInput = (placeholder: RegExp | string, value: string) => {
  const el = screen.getByPlaceholderText(placeholder)
  fireEvent.change(el, { target: { value } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSelfSignup.mockResolvedValue({
    data: { player_id: 'p1', pin: '1234', was_existing: false },
    error: null,
  })
  mockLoginWithPin.mockResolvedValue({ success: true, role: 'player' })
  mockSetOwnAvatar.mockResolvedValue('https://cdn.test/avatars/player-p1.webp')
  mockProcessAvatar.mockResolvedValue(new Blob(['x']))
  mockPlayers.current = []
})

const fillRequired = async ({ level = '3.5', last = 'Lovelace' } = {}) => {
  setInput('e.g. Augustin', 'Ada')
  setInput('e.g. Tapia', last)
  setInput('player@email.com', 'ada@example.com')
  setInput('+31612345678', '+31612345678')
  setInput('e.g. 3.5', level)
  fireEvent.click(screen.getByRole('button', { name: /female/i }))
  fireEvent.change(screen.getByPlaceholderText(/select country/i), {
    target: { value: 'Netherlands' },
  })
  fireEvent.mouseDown(await screen.findByRole('button', { name: /netherlands/i }))
}

const pickPhoto = (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, {
    target: { files: [new File(['img'], 'me.jpg', { type: 'image/jpeg' })] },
  })
}

afterEach(cleanup)

describe('SignupRequest — public signup', () => {
  it('asks for a Playtomic level and never for an adjustment', () => {
    render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)

    expect(screen.getByText('Playtomic Level (0–7)')).toBeTruthy()
    expect(screen.queryByText(/personal adjustment/i)).toBeNull()
    expect(screen.queryByText(/adjusted level/i)).toBeNull()
    expect(screen.queryByText(/positive = stronger/i)).toBeNull()
  })

  it('sends no adjustment to the signup RPC', async () => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)

    setInput('e.g. Augustin', 'Ada')
    setInput('e.g. Tapia', 'Lovelace')
    setInput('player@email.com', 'ada@example.com')
    setInput('+31612345678', '+31612345678')
    setInput('e.g. 3.5', '3.5')
    // Country + gender are required. Gender is a button; country is a
    // type-to-search picker whose first match must be clicked.
    fireEvent.click(screen.getByRole('button', { name: /female/i }))
    fireEvent.change(screen.getByPlaceholderText(/select country/i), {
      target: { value: 'Netherlands' },
    })
    // The picker's options commit on mousedown, not click.
    fireEvent.mouseDown(await screen.findByRole('button', { name: /netherlands/i }))

    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(mockSelfSignup).toHaveBeenCalled())
    const payload = mockSelfSignup.mock.calls[0][0]
    expect(payload.playtomicLevel).toBe(3.5)
    expect(payload).not.toHaveProperty('adjustment')
    expect(payload).not.toHaveProperty('adjustedLevel')
  })

  it('signs the new player in, then uploads the photo under their own id', async () => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillRequired()
    pickPhoto(container)
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(mockSetOwnAvatar).toHaveBeenCalled())
    expect(mockLoginWithPin).toHaveBeenCalledWith('1234')
    expect(mockLoginWithPin.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetOwnAvatar.mock.invocationCallOrder[0],
    )
    expect(mockSetOwnAvatar.mock.calls[0][0].playerId).toBe('p1')
  })

  it('skips the photo if sign-in fails, but still shows the PIN', async () => {
    mockLoginWithPin.mockResolvedValue({ success: false, error: 'nope' })
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillRequired()
    pickPhoto(container)
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    expect(await screen.findByText('1234')).toBeTruthy()
    await waitFor(() => expect(mockLoginWithPin).toHaveBeenCalled())
    expect(mockSetOwnAvatar).not.toHaveBeenCalled()
  })

  it('claims a matching placeholder through the signup RPC', async () => {
    mockPlayers.current = [{ id: 'ph1', name: 'Ada Lovelace', status: 'placeholder' }]
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillRequired()
    fireEvent.click(await screen.findByRole('button', { name: /yes, complete my profile/i }))
    await fillRequired()
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)

    await waitFor(() => expect(mockSelfSignup).toHaveBeenCalled())
    expect(mockSelfSignup.mock.calls[0][0].claimPlaceholderId).toBe('ph1')
  })

  it('does not offer to take over an active profile', async () => {
    mockPlayers.current = [{ id: 'a1', name: 'Ada Lovelace', status: 'active' }]
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillRequired()
    expect(await screen.findByText(/already has a profile/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /yes, complete my profile/i })).toBeNull()
    fireEvent.submit(container.querySelector('form') as HTMLFormElement)
    await new Promise((r) => setTimeout(r, 50))
    expect(mockSelfSignup).not.toHaveBeenCalled()
  })
})
