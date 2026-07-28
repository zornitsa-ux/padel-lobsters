// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

// D-028: the public "Join the Lobsters" form no longer collects a Playtomic
// adjustment. The submit test drives the real form and asserts on what reaches
// selfSignup, which is the payload builder for self_signup_player.
const { mockSelfSignup, mockLoginWithPin } = vi.hoisted(() => ({
  mockSelfSignup: vi.fn(),
  mockLoginWithPin: vi.fn(),
}))

vi.mock('../context/useApp', () => ({
  useApp: () => ({ selfSignup: mockSelfSignup, loginWithPin: mockLoginWithPin }),
}))
vi.mock('../features/players/usePlayers', () => ({
  usePlayers: () => ({ data: [] }),
  usePlayerActions: () => ({ updatePlayer: vi.fn() }),
  useAvatarUpload: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('../supabase', () => ({ supabase: { storage: { from: () => ({}) } } }))
vi.mock('../lib/processAvatar', () => ({ processAvatar: vi.fn() }))

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
