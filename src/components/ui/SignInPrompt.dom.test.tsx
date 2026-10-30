// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { mockUseApp } = vi.hoisted(() => ({ mockUseApp: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../../features/auth/authActions', () => ({
  normaliseEmail: (email: string) => email,
  looksLikeEmail: () => true,
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}))

import { SignInPrompt } from './SignInPrompt'

const renderPrompt = (props: Partial<Parameters<typeof SignInPrompt>[0]> = {}) =>
  render(
    <MemoryRouter>
      <SignInPrompt title="Sign in to see your tournament" {...props} />
    </MemoryRouter>,
  )

beforeEach(() => {
  mockUseApp.mockReturnValue({ role: 'guest', loginWithPin: vi.fn() })
})
afterEach(cleanup)

describe('SignInPrompt', () => {
  it('names what needs a sign-in, with no form until asked', () => {
    renderPrompt({ description: 'Shown to signed-in players.' })

    expect(screen.getByText('Sign in to see your tournament')).toBeTruthy()
    expect(screen.getByText('Shown to signed-in players.')).toBeTruthy()
    expect(screen.queryByLabelText('Email')).toBeNull()
  })

  it('opens the sign-in modal in place', () => {
    renderPrompt()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByLabelText('Email')).toBeTruthy()
  })

  it('inline drops the card shell', () => {
    const { container } = renderPrompt({ variant: 'inline' })

    expect(container.querySelector('.card')).toBeNull()
  })
})
