// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { mockSupabase } from '../test/mockSupabase'

const { verifyOtp, mockUseApp } = vi.hoisted(() => ({ verifyOtp: vi.fn(), mockUseApp: vi.fn() }))
vi.mock('../supabase', () => mockSupabase({ auth: { verifyOtp } }))
vi.mock('../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../features/auth/PasswordForm', () => ({
  PasswordForm: ({
    requireCurrentPassword,
    onDone,
  }: {
    requireCurrentPassword: boolean
    onDone: () => void
  }) => (
    <button data-require-current={String(requireCurrentPassword)} onClick={onDone}>
      Save password
    </button>
  ),
}))

import AuthConfirm from './AuthConfirm'

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  verifyOtp.mockResolvedValue({ error: null })
  mockUseApp.mockReturnValue({ session: null, sessionSettled: true })
})
afterEach(cleanup)

describe('AuthConfirm — tap to confirm', () => {
  it('does not verify until the button is tapped', () => {
    renderAt('/auth/confirm?token_hash=abc&type=magiclink&next=/home')

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /tap to finish signing in/i })).toBeTruthy()
  })

  it('verifies on tap and goes to the saved return path first', async () => {
    window.localStorage.setItem('pl_auth_return_path', '/transfer/7?x=1')
    renderAt('/auth/confirm?token_hash=abc&type=magiclink&next=/home')
    fireEvent.click(screen.getByRole('button', { name: /tap to finish signing in/i }))

    expect((await screen.findByTestId('where')).textContent).toBe('/transfer/7?x=1')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'magiclink' })
    expect(window.localStorage.getItem('pl_auth_return_path')).toBeNull()
  })

  it('falls back to a valid next, then /home', async () => {
    renderAt('/auth/confirm?token_hash=abc&type=email&next=/events')
    fireEvent.click(screen.getByRole('button'))
    expect((await screen.findByTestId('where')).textContent).toBe('/events')
    cleanup()

    renderAt('/auth/confirm?token_hash=abc&type=email&next=//evil.example')
    fireEvent.click(screen.getByRole('button'))
    expect((await screen.findByTestId('where')).textContent).toBe('/home')
  })

  it('shows the expired-link message when verify fails', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    renderAt('/auth/confirm?token_hash=abc&type=magiclink')
    fireEvent.click(screen.getByRole('button'))

    expect(await screen.findByText(/link has expired/i)).toBeTruthy()
  })

  it('reports a link without a token', () => {
    renderAt('/auth/confirm?type=magiclink')

    expect(screen.getByText(/missing its verification token/i)).toBeTruthy()
  })
})

describe('AuthConfirm — recovery', () => {
  it('shows Set a new password after the tap, with no current-password field, then goes on', async () => {
    window.localStorage.setItem('pl_auth_return_path', '/community')
    renderAt('/auth/confirm?token_hash=abc&type=recovery&next=/home')
    fireEvent.click(screen.getByRole('button', { name: /choose a new password/i }))

    const save = await screen.findByRole('button', { name: /save password/i })
    expect(screen.getByText('Set a new password')).toBeTruthy()
    expect(save.getAttribute('data-require-current')).toBe('false')
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'recovery' })

    fireEvent.click(save)
    expect((await screen.findByTestId('where')).textContent).toBe('/community')
  })

  it('skips verification for an in-app code that already signed in', async () => {
    mockUseApp.mockReturnValue({ session: { user: {} }, sessionSettled: true })
    renderAt('/auth/confirm?type=recovery&verified=1')

    expect(await screen.findByRole('button', { name: /save password/i })).toBeTruthy()
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it('errors when the in-app recovery has no session', () => {
    renderAt('/auth/confirm?type=recovery&verified=1')

    expect(screen.getByText(/reset session has ended/i)).toBeTruthy()
  })
})

describe('AuthConfirm — email change', () => {
  it('keeps today’s confirmation screen', async () => {
    renderAt('/auth/confirm?token_hash=abc&type=email_change&next=/settings')
    fireEvent.click(screen.getByRole('button', { name: /confirm the change/i }))

    await waitFor(() => expect(screen.getByText('Email updated')).toBeTruthy())
    expect(screen.getByRole('button', { name: /back to account/i })).toBeTruthy()
  })
})
