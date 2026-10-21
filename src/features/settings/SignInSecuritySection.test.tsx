// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { mockUseApp, signOutEverywhere } = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  signOutEverywhere: vi.fn(),
}))
vi.mock('../../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../auth/authActions', () => ({ signOutEverywhere }))
vi.mock('./EmailChangeField', () => ({
  EmailChangeField: ({ email }: { email: string }) => <p>email:{email}</p>,
}))
vi.mock('../auth/PasswordForm', () => ({
  PasswordForm: ({ requireCurrentPassword }: { requireCurrentPassword: boolean }) => (
    <p>password form current:{String(requireCurrentPassword)}</p>
  ),
}))

import SignInSecuritySection from './SignInSecuritySection'

const sessionWith = (amr: { method: string }[]) => ({
  access_token: `h.${btoa(JSON.stringify({ amr }))}.s`,
  user: { email: 'ada@example.com' },
})

beforeEach(() => {
  vi.clearAllMocks()
  signOutEverywhere.mockResolvedValue({ error: null })
})
afterEach(cleanup)

describe('SignInSecuritySection', () => {
  it('shows the sign-in email', () => {
    mockUseApp.mockReturnValue({ session: sessionWith([{ method: 'otp' }]) })
    render(<SignInSecuritySection />)

    expect(screen.getByText('email:ada@example.com')).toBeTruthy()
  })

  it('offers "Set or change password" with no current-password need for a code session', () => {
    mockUseApp.mockReturnValue({ session: sessionWith([{ method: 'otp' }]) })
    render(<SignInSecuritySection />)
    fireEvent.click(screen.getByRole('button', { name: /set or change password/i }))

    expect(screen.getByText('password form current:false')).toBeTruthy()
  })

  it('offers "Change password" and needs the current one for a password session', () => {
    mockUseApp.mockReturnValue({ session: sessionWith([{ method: 'password' }]) })
    render(<SignInSecuritySection />)
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(screen.getByText('password form current:true')).toBeTruthy()
  })

  it('signs out of all devices', async () => {
    mockUseApp.mockReturnValue({ session: sessionWith([{ method: 'otp' }]) })
    render(<SignInSecuritySection />)
    fireEvent.click(screen.getByRole('button', { name: /sign out of all devices/i }))

    await waitFor(() => expect(signOutEverywhere).toHaveBeenCalledTimes(1))
  })

  it('reports a failed global sign-out', async () => {
    signOutEverywhere.mockResolvedValue({ error: { message: 'x' } })
    mockUseApp.mockReturnValue({ session: sessionWith([{ method: 'otp' }]) })
    render(<SignInSecuritySection />)
    fireEvent.click(screen.getByRole('button', { name: /sign out of all devices/i }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not sign you out/i)
  })
})
