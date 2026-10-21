// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockUseApp, requestEmailCode, verifyEmailCode } = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}))
vi.mock('../../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../../features/auth/authActions', () => ({
  normaliseEmail: (email: string) => email,
  looksLikeEmail: () => true,
  requestEmailCode,
  verifyEmailCode,
}))

import { SignInModal, roleSatisfies, useAuthPrompt } from './AuthGate'

const renderModal = (props: Partial<Parameters<typeof SignInModal>[0]> = {}) =>
  render(
    <MemoryRouter>
      <SignInModal open {...props} />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  mockUseApp.mockReturnValue({ role: 'guest', loginWithPin: vi.fn() })
  requestEmailCode.mockResolvedValue({ error: null })
})
afterEach(cleanup)

describe('SignInModal', () => {
  it('shows the sign-in form prefilled, without the PIN option', () => {
    renderModal({ initialEmail: 'ada@example.com' })

    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('ada@example.com')
    expect(screen.queryByText(/sign in with pin/i)).toBeNull()
  })

  it('renders nothing when closed', () => {
    const view = renderModal({ open: false })

    expect(view.container.innerHTML).toBe('')
  })

  it('closes itself once the session has a role', () => {
    mockUseApp.mockReturnValue({ role: 'player', loginWithPin: vi.fn() })
    const onClose = vi.fn()
    renderModal({ onClose })

    expect(onClose).toHaveBeenCalled()
  })
})

describe('SignInModal — role', () => {
  it('stays open for an admin prompt when a player is signed in', () => {
    mockUseApp.mockReturnValue({ role: 'player', loginWithPin: vi.fn() })
    const onClose = vi.fn()
    renderModal({ onClose, role: 'admin' })

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })

  it('closes for an admin prompt when an admin is signed in', () => {
    mockUseApp.mockReturnValue({ role: 'admin', loginWithPin: vi.fn() })
    const onClose = vi.fn()
    renderModal({ onClose, role: 'admin' })

    expect(onClose).toHaveBeenCalled()
  })

  it('roleSatisfies: admin needs admin, player needs any signed-in role', () => {
    expect(roleSatisfies({ required: 'admin', role: 'player' })).toBe(false)
    expect(roleSatisfies({ required: 'admin', role: 'admin' })).toBe(true)
    expect(roleSatisfies({ required: 'player', role: 'admin' })).toBe(true)
    expect(roleSatisfies({ required: 'player', role: 'guest' })).toBe(false)
  })
})

const signInThroughCode = async () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /email me a sign-in code/i }))
  fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
}

describe('SignInModal — pending callback', () => {
  it('runs it for a player prompt after a player signs in', async () => {
    verifyEmailCode.mockResolvedValue({ session: { user: { app_metadata: {} } }, error: null })
    const onSuccess = vi.fn()
    renderModal({ onSuccess })
    await signInThroughCode()

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('does not run an admin callback when a player signs in', async () => {
    verifyEmailCode.mockResolvedValue({
      session: { user: { app_metadata: { role: 'player' } } },
      error: null,
    })
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    renderModal({ role: 'admin', onSuccess, onClose })
    await signInThroughCode()

    expect((await screen.findByRole('alert')).textContent).toMatch(/needs an admin account/i)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('useAuthPrompt', () => {
  const Harness = ({ onNavigate }: { onNavigate: () => void }) => {
    const { requireAuth, AuthPromptModal } = useAuthPrompt({ onNavigate })
    return (
      <>
        <button onClick={() => requireAuth('player')}>open</button>
        <AuthPromptModal />
      </>
    )
  }

  it('keeps the code step when the parent re-renders with a new onNavigate', async () => {
    const tree = (onNavigate: () => void) => (
      <MemoryRouter>
        <Harness onNavigate={onNavigate} />
      </MemoryRouter>
    )
    const view = render(tree(() => {}))
    fireEvent.click(screen.getByText('open'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /email me a sign-in code/i }))
    await screen.findByLabelText('Code')

    view.rerender(tree(() => {}))

    expect(screen.getByLabelText('Code')).toBeTruthy()
  })
})
