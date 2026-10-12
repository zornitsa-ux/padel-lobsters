// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { mockSupabase } from '../test/mockSupabase'

// D-028: the public "Join the Lobsters" form no longer collects a Playtomic
// adjustment. The submit test drives the real form and asserts on what reaches
// selfSignup, which is the payload builder for self_signup_player.
const { mockSelfSignup, mockLoginWithPin, mockSetOwnAvatar, roster } = vi.hoisted(() => ({
  mockSelfSignup: vi.fn(),
  mockLoginWithPin: vi.fn(),
  mockSetOwnAvatar: vi.fn(),
  roster: { players: [] as { id: string; name: string; status: string }[] },
}))

vi.mock('../context/useApp', () => ({
  useApp: () => ({ selfSignup: mockSelfSignup, loginWithPin: mockLoginWithPin }),
}))
vi.mock('../features/players/usePlayers', () => ({
  usePlayers: () => ({ data: roster.players }),
}))
vi.mock('../features/players/playerQueries', () => ({ setOwnAvatar: mockSetOwnAvatar }))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))
vi.mock('../supabase', () => mockSupabase({ storage: { from: () => ({}) } }))
vi.mock('../lib/processAvatar', () => ({ processAvatar: vi.fn(async (f: File) => f) }))

import SignupRequest from './SignupRequest'

const setInput = (placeholder: RegExp | string, value: string) => {
  const el = screen.getByPlaceholderText(placeholder)
  fireEvent.change(el, { target: { value } })
}

// Fills every required field; `name` and `level` vary per test.
const fillForm = async ({
  first = 'Ada',
  last = 'Lovelace',
  level = '3.5',
}: { first?: string; last?: string; level?: string } = {}) => {
  setInput('e.g. Augustin', first)
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

const submit = (container: HTMLElement) =>
  fireEvent.submit(container.querySelector('form') as HTMLFormElement)

beforeEach(() => {
  vi.clearAllMocks()
  roster.players = []
  mockSetOwnAvatar.mockResolvedValue('https://cdn.test/avatars/player-p1.webp')
  mockSelfSignup.mockResolvedValue({
    data: { player_id: 'p1', pin: '1234', was_existing: false },
    error: null,
  })
  mockLoginWithPin.mockResolvedValue({ success: true, role: 'player' })
})

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
})

describe('SignupRequest — name matches', () => {
  it('blocks a placeholder name and points to the admin invite', async () => {
    roster.players = [{ id: 'ph1', name: 'Ada  Lovelace', status: 'placeholder' }]
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()

    expect(await screen.findByText(/waiting for an invite/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /different person/i })).toBeNull()
    submit(container)
    expect(mockSelfSignup).not.toHaveBeenCalled()
  })

  it('shows the invite message when the server refuses a placeholder name', async () => {
    mockSelfSignup.mockResolvedValue({ data: null, error: { message: 'placeholder needs invite' } })
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()
    submit(container)

    expect(await screen.findByText(/an admin needs to send you an invite/i)).toBeTruthy()
    expect(mockLoginWithPin).not.toHaveBeenCalled()
  })

  it('sends an active name match to sign-in', async () => {
    roster.players = [{ id: 'a1', name: 'Ada Lovelace', status: 'active' }]
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()

    expect(await screen.findByText(/this name already has a profile/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /go to sign in/i })).toBeTruthy()
    submit(container)
    expect(mockSelfSignup).not.toHaveBeenCalled()
  })

  it('lets a different person with the same name sign up', async () => {
    roster.players = [{ id: 'a1', name: 'Ada Lovelace', status: 'active' }]
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()

    fireEvent.click(await screen.findByRole('button', { name: /different person/i }))
    submit(container)

    await waitFor(() => expect(mockSelfSignup).toHaveBeenCalled())
  })
})

describe('SignupRequest — after signup', () => {
  it('keeps the PIN on screen until the user continues', async () => {
    const onComplete = vi.fn()
    const { container } = render(<SignupRequest onComplete={onComplete} onBack={() => {}} />)
    await fillForm()
    submit(container)

    expect(await screen.findByText('1234')).toBeTruthy()
    expect(mockLoginWithPin).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /continue to the app/i }))
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('player'))
    expect(mockLoginWithPin).toHaveBeenCalledWith('1234')
  })

  it('uploads the photo to the new player only after signing in', async () => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' })
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [photo] },
    })
    await fillForm()
    submit(container)
    await screen.findByText('1234')

    expect(mockSelfSignup.mock.calls[0][0]).not.toHaveProperty('avatarUrl')
    expect(mockSetOwnAvatar).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /continue to the app/i }))
    await waitFor(() =>
      expect(mockSetOwnAvatar).toHaveBeenCalledWith({ playerId: 'p1', file: photo }),
    )
  })

  it('skips the photo when sign-in fails', async () => {
    mockLoginWithPin.mockResolvedValue({ success: false, error: 'wrong_pin' })
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'me.jpg', { type: 'image/jpeg' })] },
    })
    await fillForm()
    submit(container)
    await screen.findByText('1234')

    fireEvent.click(screen.getByRole('button', { name: /continue to the app/i }))
    expect(await screen.findByText('wrong_pin')).toBeTruthy()
    expect(mockSetOwnAvatar).not.toHaveBeenCalled()
  })
})

describe('SignupRequest — Playtomic level', () => {
  it.each([
    ['2,2', 2.2],
    ['2.45', 2.45],
  ])('accepts %s', async (level, expected) => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm({ level })
    submit(container)

    await waitFor(() => expect(mockSelfSignup).toHaveBeenCalled())
    expect(mockSelfSignup.mock.calls[0][0].playtomicLevel).toBe(expected)
  })

  it.each(['abc', '8'])('rejects %s before calling the server', async (level) => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm({ level })
    submit(container)

    expect(await screen.findByText(/from 0 to 7/i)).toBeTruthy()
    expect(mockSelfSignup).not.toHaveBeenCalled()
  })
})
