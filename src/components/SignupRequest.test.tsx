// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { mockSupabase } from '../test/mockSupabase'

// The form hands the profile to signInWithOtp as user_metadata (C-2); the
// before_user_created hook validates it. Tests drive the real form and assert
// on what reaches requestEmailCode, then on the code step that follows.
const { mockRequestCode, mockVerifyCode, mockSetOwnAvatar, roster } = vi.hoisted(() => ({
  mockRequestCode: vi.fn(),
  mockVerifyCode: vi.fn(),
  mockSetOwnAvatar: vi.fn(),
  roster: { players: [] as { id: string; name: string; status: string }[] },
}))

vi.mock('../features/auth/authActions', () => ({
  requestEmailCode: mockRequestCode,
  verifyEmailCode: mockVerifyCode,
  normaliseEmail: (email: string) => email.trim().toLowerCase(),
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
import { SIGNUP_HOOK_MESSAGES } from '../features/auth/signupErrors'

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
  mockRequestCode.mockResolvedValue({ error: null })
  mockVerifyCode.mockResolvedValue({
    session: { user: { id: 'p1', email_confirmed_at: new Date().toISOString() } },
    error: null,
  })
})

afterEach(cleanup)

const enterCode = (code = '123456') => {
  fireEvent.change(screen.getByLabelText('Code'), { target: { value: code } })
  fireEvent.click(screen.getByRole('button', { name: /finish signing up/i }))
}

describe('SignupRequest — public signup', () => {
  it('asks for a Playtomic level and never for an adjustment', () => {
    render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)

    expect(screen.getByText('Playtomic Level (0–7)')).toBeTruthy()
    expect(screen.queryByText(/personal adjustment/i)).toBeNull()
    expect(screen.queryByText(/adjusted level/i)).toBeNull()
  })

  it('creates the user through signInWithOtp with exactly the C-2 metadata', async () => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()
    submit(container)

    await waitFor(() => expect(mockRequestCode).toHaveBeenCalled())
    const call = mockRequestCode.mock.calls[0][0]
    expect(call.email).toBe('ada@example.com')
    expect(call.shouldCreateUser).toBe(true)
    expect(Object.keys(call.data).sort()).toEqual(
      [
        'birthday',
        'country',
        'gender',
        'is_left_handed',
        'name',
        'notes',
        'phone',
        'playtomic_level',
        'playtomic_username',
        'preferred_position',
        'tagline_label',
      ].sort(),
    )
    expect(call.data).toMatchObject({
      name: 'Ada Lovelace',
      playtomic_level: '3.5',
      is_left_handed: 'false',
      gender: 'female',
    })
    expect(call.data).not.toHaveProperty('adjustment')
  })

  it('shows no PIN anywhere and moves to the code step', async () => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()
    submit(container)

    expect(await screen.findByText(/we sent a 6-digit code/i)).toBeTruthy()
    expect(screen.getByText(/only the newest one works/i)).toBeTruthy()
    expect(screen.queryByText(/pin/i)).toBeNull()
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
    expect(mockRequestCode).not.toHaveBeenCalled()
  })

  it('sends an active name match to sign-in', async () => {
    roster.players = [{ id: 'a1', name: 'Ada Lovelace', status: 'active' }]
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()

    expect(await screen.findByText(/this name already has a profile/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /go to sign in/i })).toBeTruthy()
    submit(container)
    expect(mockRequestCode).not.toHaveBeenCalled()
  })

  it('lets a different person with the same name sign up', async () => {
    roster.players = [{ id: 'a1', name: 'Ada Lovelace', status: 'active' }]
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()

    fireEvent.click(await screen.findByRole('button', { name: /different person/i }))
    submit(container)

    await waitFor(() => expect(mockRequestCode).toHaveBeenCalled())
  })
})

describe('SignupRequest — hook rejections', () => {
  const rejectWith = (message: string) =>
    mockRequestCode.mockResolvedValue({ error: { status: 400, code: 'unknown', message } })

  it.each([
    [SIGNUP_HOOK_MESSAGES.nameRequired, 'name'],
    [SIGNUP_HOOK_MESSAGES.nameTooLong, 'name'],
    [SIGNUP_HOOK_MESSAGES.placeholder, 'name'],
    [SIGNUP_HOOK_MESSAGES.levelInvalid, 'level'],
  ])('shows "%s" next to the %s field', async (message, field) => {
    rejectWith(message)
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()
    submit(container)

    const alert = await screen.findByText(message)
    const near =
      field === 'name'
        ? screen.getByPlaceholderText('e.g. Tapia')
        : screen.getByPlaceholderText('e.g. 3.5')
    expect(alert.closest('form')).toBe(near.closest('form'))
    expect(screen.queryByText(/we sent a 6-digit code/i)).toBeNull()
  })

  it('shows generic copy for any other error', async () => {
    mockRequestCode.mockResolvedValue({ error: { status: 500, message: 'boom' } })
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()
    submit(container)

    expect(await screen.findByText(/could not create your profile/i)).toBeTruthy()
  })

  it('shows the wait on the form for a 429 retry', async () => {
    mockRequestCode.mockResolvedValue({
      error: {
        status: 429,
        code: 'over_email_send_rate_limit',
        message: 'For security purposes, you can only request this after 42 seconds.',
      },
    })
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm()
    submit(container)

    expect(await screen.findByText(/wait 42 seconds/i)).toBeTruthy()
  })
})

describe('SignupRequest — code step', () => {
  const toCodeStep = async () => {
    const onComplete = vi.fn()
    const view = render(<SignupRequest onComplete={onComplete} onBack={() => {}} />)
    const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' })
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [photo] },
    })
    await fillForm()
    submit(view.container)
    await screen.findByLabelText('Code')
    return { onComplete, photo }
  }

  it('uploads the photo to the new player only after the code verifies', async () => {
    const { onComplete, photo } = await toCodeStep()

    expect(mockRequestCode.mock.calls[0][0].data).not.toHaveProperty('avatar_url')
    expect(mockSetOwnAvatar).not.toHaveBeenCalled()

    enterCode()
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('player'))
    expect(mockVerifyCode).toHaveBeenCalledWith({
      email: 'ada@example.com',
      token: '123456',
      type: 'email',
    })
    await waitFor(() =>
      expect(mockSetOwnAvatar).toHaveBeenCalledWith({ playerId: 'p1', file: photo }),
    )
  })

  it('does not overwrite the photo of an account that already existed', async () => {
    mockVerifyCode.mockResolvedValue({
      session: { user: { id: 'p1', email_confirmed_at: '2026-01-01T00:00:00Z' } },
      error: null,
    })
    const { onComplete } = await toCodeStep()

    enterCode()
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
    expect(mockSetOwnAvatar).not.toHaveBeenCalled()
  })

  it('discards the saved return path once signed in', async () => {
    window.localStorage.setItem('pl_auth_return_path', '/events')
    const { onComplete } = await toCodeStep()

    enterCode()
    await waitFor(() => expect(onComplete).toHaveBeenCalled())
    expect(window.localStorage.getItem('pl_auth_return_path')).toBeNull()
  })

  it('skips the photo and stays on the step when the code is wrong', async () => {
    mockVerifyCode.mockResolvedValue({ session: null, error: { status: 403, code: 'otp_expired' } })
    const { onComplete } = await toCodeStep()

    enterCode()
    expect(await screen.findByText(/code didn't work/i)).toBeTruthy()
    expect(onComplete).not.toHaveBeenCalled()
    expect(mockSetOwnAvatar).not.toHaveBeenCalled()
  })

  it('goes back to the form with the details kept', async () => {
    await toCodeStep()

    fireEvent.click(screen.getByRole('button', { name: /change email/i }))
    expect((screen.getByPlaceholderText('e.g. Augustin') as HTMLInputElement).value).toBe('Ada')
  })
})

describe('SignupRequest — Playtomic level', () => {
  it.each([
    ['2,2', '2.2'],
    ['2.45', '2.45'],
  ])('accepts %s', async (level, expected) => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm({ level })
    submit(container)

    await waitFor(() => expect(mockRequestCode).toHaveBeenCalled())
    expect(mockRequestCode.mock.calls[0][0].data.playtomic_level).toBe(expected)
  })

  it.each(['abc', '8'])('rejects %s before calling the server', async (level) => {
    const { container } = render(<SignupRequest onComplete={() => {}} onBack={() => {}} />)
    await fillForm({ level })
    submit(container)

    expect(await screen.findByText(/from 0 to 7/i)).toBeTruthy()
    expect(mockRequestCode).not.toHaveBeenCalled()
  })
})
