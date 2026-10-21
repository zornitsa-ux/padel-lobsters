// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const actions = vi.hoisted(() => ({
  setPassword: vi.fn(),
  requestReauthentication: vi.fn(),
}))
vi.mock('./authActions', () => actions)

import { PasswordForm } from './PasswordForm'

const renderForm = ({ requireCurrentPassword = false } = {}) => {
  const onDone = vi.fn()
  render(
    <PasswordForm
      requireCurrentPassword={requireCurrentPassword}
      submitLabel="Save password"
      onDone={onDone}
    />,
  )
  return { onDone }
}
const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const save = () => fireEvent.click(screen.getByRole('button', { name: /save password/i }))

beforeEach(() => {
  vi.clearAllMocks()
  actions.setPassword.mockResolvedValue({ error: null })
  actions.requestReauthentication.mockResolvedValue({ error: null })
})
afterEach(cleanup)

describe('PasswordForm', () => {
  it('states the rules up front', () => {
    renderForm()
    expect(screen.getByText(/at least 10 characters/i)).toBeTruthy()
  })

  it('has no current-password field for a code, link or recovery session', () => {
    renderForm()
    expect(screen.queryByLabelText('Current password')).toBeNull()
  })

  it('sends the current password too when the session signed in with one', async () => {
    const { onDone } = renderForm({ requireCurrentPassword: true })
    fill('Current password', 'Old-Password-1')
    fill('New password', 'New-Password-2')
    save()

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(actions.setPassword).toHaveBeenCalledWith({
      password: 'New-Password-2',
      currentPassword: 'Old-Password-1',
      nonce: '',
    })
  })

  it.each([
    ['weak_password', ['length'], /at least 10 characters/i],
    ['weak_password', ['pwned'], /known data breach/i],
    ['current_password_required', undefined, /enter your current password/i],
    ['current_password_invalid', undefined, /current password isn't right/i],
  ])('maps %s %j', async (code, reasons, message) => {
    actions.setPassword.mockResolvedValue({ error: { status: 422, code, reasons } })
    const { onDone } = renderForm({ requireCurrentPassword: true })
    fill('New password', 'whatever')
    save()

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((alert) => message.test(alert.textContent ?? ''))).toBe(true)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('asks for the emailed code on reauthentication_needed, then sends it as the nonce', async () => {
    actions.setPassword.mockResolvedValueOnce({
      error: { status: 400, code: 'reauthentication_needed' },
    })
    const { onDone } = renderForm()
    fill('New password', 'New-Password-2')
    save()

    expect(await screen.findByLabelText('Code from your email')).toBeTruthy()
    expect(actions.requestReauthentication).toHaveBeenCalledTimes(1)

    fill('Code from your email', '123456')
    save()

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(actions.setPassword).toHaveBeenLastCalledWith({
      password: 'New-Password-2',
      currentPassword: '',
      nonce: '123456',
    })
  })
})
