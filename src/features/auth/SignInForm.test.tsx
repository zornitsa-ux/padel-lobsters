// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const actions = vi.hoisted(() => ({
  requestEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  signInWithPassword: vi.fn(),
  sendPasswordReset: vi.fn(),
  currentSession: vi.fn(),
}))
const { loginWithPin, mockNavigate } = vi.hoisted(() => ({
  loginWithPin: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('./authActions', () => ({
  ...actions,
  normaliseEmail: (email: string) => email.trim().toLowerCase(),
  looksLikeEmail: (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email),
}))
vi.mock('../../context/useApp', () => ({ useApp: () => ({ loginWithPin }) }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => mockNavigate,
}))

import { hasPinSignIn } from './pinSignInFlag'
import { PIN_SUNSET_LABEL } from './pinSunset'
import { SignInForm, type SignInFormProps } from './SignInForm'

const session = { user: { id: 'u1' } }
const rateLimit = {
  status: 429,
  code: 'over_email_send_rate_limit',
  message: 'you can only request this after 25 seconds.',
}

const renderForm = (props: Partial<SignInFormProps> = {}) =>
  render(
    <MemoryRouter>
      <SignInForm variant="page" allowPin={false} {...props} />
    </MemoryRouter>,
  )

const typeEmail = (email: string) =>
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
const tick = async (seconds: number) => {
  for (let i = 0; i < seconds; i++) await act(async () => vi.advanceTimersByTimeAsync(1000))
}
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }))

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  actions.requestEmailCode.mockResolvedValue({ error: null })
  actions.verifyEmailCode.mockResolvedValue({ session, error: null })
  actions.signInWithPassword.mockResolvedValue({ session, error: null })
  actions.sendPasswordReset.mockResolvedValue({ error: null })
  actions.currentSession.mockResolvedValue(session)
  loginWithPin.mockResolvedValue({ success: true, role: 'player', error: undefined })
})
afterEach(cleanup)

const toCodeStep = async () => {
  renderForm({ initialEmail: 'Ada@Example.com' })
  click(/email me a sign-in code/i)
  await screen.findByLabelText('Code')
}

describe('SignInForm — email step', () => {
  it('prefills the initial email and requests a code for the normalised address', async () => {
    renderForm({ initialEmail: 'Ada@Example.com' })
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('Ada@Example.com')

    click(/email me a sign-in code/i)

    await waitFor(() =>
      expect(actions.requestEmailCode).toHaveBeenCalledWith({ email: 'ada@example.com' }),
    )
    expect(await screen.findByLabelText('Code')).toBeTruthy()
  })

  it('rejects a malformed address without calling the server', () => {
    renderForm()
    typeEmail('nope')
    click(/email me a sign-in code/i)

    expect(screen.getByRole('alert').textContent).toMatch(/valid email/i)
    expect(actions.requestEmailCode).not.toHaveBeenCalled()
  })

  it('tells an unknown email apart', async () => {
    actions.requestEmailCode.mockResolvedValue({ error: { status: 422, code: 'otp_disabled' } })
    renderForm({ initialEmail: 'ghost@example.com' })
    click(/email me a sign-in code/i)

    expect((await screen.findByRole('alert')).textContent).toMatch(/couldn't find that email/i)
  })

  it('shows the wait when rate-limited', async () => {
    actions.requestEmailCode.mockResolvedValue({ error: rateLimit })
    renderForm({ initialEmail: 'ada@example.com' })
    click(/email me a sign-in code/i)

    expect((await screen.findByRole('alert')).textContent).toMatch(/wait 25 seconds/i)
  })

  it('offers no PIN unless allowed', () => {
    renderForm()
    expect(screen.queryByText(/sign in with pin/i)).toBeNull()
  })
})

describe('SignInForm — code step', () => {
  it('has a one-time-code input and signs in once with the session', async () => {
    const onSignedIn = vi.fn()
    renderForm({ initialEmail: 'ada@example.com', onSignedIn })
    click(/email me a sign-in code/i)
    const input = (await screen.findByLabelText('Code')) as HTMLInputElement

    expect(input.getAttribute('autocomplete')).toBe('one-time-code')
    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.maxLength).toBe(6)

    fireEvent.change(input, { target: { value: '12ab3456' } })
    expect(input.value).toBe('123456')
    click(/^sign in$/i)

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledTimes(1))
    expect(onSignedIn).toHaveBeenCalledWith(session)
    expect(actions.verifyEmailCode).toHaveBeenCalledWith({
      email: 'ada@example.com',
      token: '123456',
      type: 'email',
    })
    expect(screen.getByText(/signed in/i)).toBeTruthy()
  })

  it('keeps the submit disabled until six digits', async () => {
    await toCodeStep()
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123' } })

    expect((screen.getByRole('button', { name: /^sign in$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
  })

  it('explains a wrong or expired code and stays on the step', async () => {
    actions.verifyEmailCode.mockResolvedValue({
      session: null,
      error: { status: 403, code: 'otp_expired' },
    })
    const onSignedIn = vi.fn()
    renderForm({ initialEmail: 'ada@example.com', onSignedIn })
    click(/email me a sign-in code/i)
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '123456' } })
    click(/^sign in$/i)

    expect((await screen.findByRole('alert')).textContent).toMatch(/code didn't work/i)
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('disables resend for 60 seconds with a countdown, then resends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    try {
      renderForm({ initialEmail: 'ada@example.com' })
      await act(async () => click(/email me a sign-in code/i))
      const resend = () => screen.getByRole('button', { name: /resend code/i }) as HTMLButtonElement

      expect(resend().disabled).toBe(true)
      expect(resend().textContent).toContain('1:00')

      await tick(15)
      expect(resend().textContent).toContain('0:45')

      await tick(45)
      expect(resend().disabled).toBe(false)

      await act(async () => fireEvent.click(resend()))
      expect(actions.requestEmailCode).toHaveBeenCalledTimes(2)
      expect(resend().disabled).toBe(true)
      expect(screen.getByText(/only the newest code works/i)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends one request for a double-tapped resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    try {
      renderForm({ initialEmail: 'ada@example.com' })
      await act(async () => click(/email me a sign-in code/i))
      await tick(60)
      let release: (value: { error: null }) => void = () => {}
      actions.requestEmailCode.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
      const resend = screen.getByRole('button', { name: /resend code/i })
      await act(async () => {
        fireEvent.click(resend)
        fireEvent.click(resend)
      })
      release({ error: null })

      expect(actions.requestEmailCode).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('goes back to the email step on Change email', async () => {
    await toCodeStep()
    click(/change email/i)

    expect(screen.getByLabelText('Email')).toBeTruthy()
  })
})

describe('SignInForm — return path', () => {
  it('discards a saved return path when sign-in completes in the app', async () => {
    window.localStorage.setItem('pl_auth_return_path', '/transfer/9')
    const onSignedIn = vi.fn()
    renderForm({ initialEmail: 'ada@example.com', onSignedIn })
    click(/email me a sign-in code/i)
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '123456' } })
    click(/^sign in$/i)

    await waitFor(() => expect(onSignedIn).toHaveBeenCalled())
    expect(window.localStorage.getItem('pl_auth_return_path')).toBeNull()
  })
})

describe('SignInForm — password step', () => {
  const toPassword = () => {
    renderForm({ initialEmail: 'ada@example.com' })
    click(/sign in with password/i)
  }

  it('signs in with email and password', async () => {
    const onSignedIn = vi.fn()
    renderForm({ initialEmail: 'ada@example.com', onSignedIn })
    click(/sign in with password/i)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correct-Horse-9' } })
    click(/^sign in$/i)

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session))
    expect(actions.signInWithPassword).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: 'Correct-Horse-9',
    })
  })

  it('shows a mismatch for bad credentials', async () => {
    actions.signInWithPassword.mockResolvedValue({
      session: null,
      error: { status: 400, code: 'invalid_credentials' },
    })
    toPassword()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    click(/^sign in$/i)

    expect((await screen.findByRole('alert')).textContent).toMatch(/don't match/i)
  })

  it('can switch back to a code', () => {
    toPassword()
    click(/email me a code instead/i)

    expect(screen.getByRole('button', { name: /email me a sign-in code/i })).toBeTruthy()
  })
})

describe('SignInForm — forgot password', () => {
  const toForgot = () => {
    renderForm({ initialEmail: 'ada@example.com' })
    click(/sign in with password/i)
    click(/forgot password/i)
  }

  it('sends a reset and waits for the code', async () => {
    toForgot()
    click(/send reset code/i)

    await waitFor(() =>
      expect(actions.sendPasswordReset).toHaveBeenCalledWith({ email: 'ada@example.com' }),
    )
    expect(await screen.findByLabelText('Code')).toBeTruthy()
  })

  it('verifies a recovery code and continues to the new-password screen', async () => {
    const onSignedIn = vi.fn()
    renderForm({ initialEmail: 'ada@example.com', onSignedIn })
    click(/sign in with password/i)
    click(/forgot password/i)
    click(/send reset code/i)
    fireEvent.change(await screen.findByLabelText('Code'), { target: { value: '654321' } })
    click(/^continue$/i)

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/auth/confirm?type=recovery&verified=1'),
    )
    expect(actions.verifyEmailCode).toHaveBeenCalledWith({
      email: 'ada@example.com',
      token: '654321',
      type: 'recovery',
    })
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('shows a rate-limit wait', async () => {
    actions.sendPasswordReset.mockResolvedValue({ error: rateLimit })
    toForgot()
    click(/send reset code/i)

    expect((await screen.findByRole('alert')).textContent).toMatch(/wait 25 seconds/i)
  })
})

describe('SignInForm — PIN sub-state', () => {
  it('labels the PIN link with the sunset date and reuses loginWithPin', async () => {
    const onSignedIn = vi.fn()
    renderForm({ allowPin: true, onSignedIn })
    click(`Sign in with PIN (until ${PIN_SUNSET_LABEL})`)
    fireEvent.change(screen.getByLabelText(/your pin/i), { target: { value: '1234' } })
    click(/sign in with pin$/i)

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(session))
    expect(loginWithPin).toHaveBeenCalledWith('1234')
    expect(hasPinSignIn()).toBe(true)
  })

  it('does not flag an email-code sign-in', async () => {
    const onSignedIn = vi.fn()
    renderForm({ onSignedIn })
    typeEmail('ada@example.com')
    click(/email me a sign-in code/i)
    await screen.findByLabelText(/code/i)
    expect(hasPinSignIn()).toBe(false)
  })

  it('shows the server error for a wrong PIN', async () => {
    loginWithPin.mockResolvedValue({ success: false, role: 'guest', error: 'Wrong PIN' })
    renderForm({ allowPin: true })
    click(/sign in with pin \(until/i)
    fireEvent.change(screen.getByLabelText(/your pin/i), { target: { value: '0000' } })
    click(/sign in with pin$/i)

    expect((await screen.findByRole('alert')).textContent).toBe('Wrong PIN')
  })
})
