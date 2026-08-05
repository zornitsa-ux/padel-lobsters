// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import JoinEventCard from './JoinEventCard'
import type { MyRegistrationSummary } from '../nextMatch'

const summaryOf = (over: Partial<MyRegistrationSummary> = {}): MyRegistrationSummary => ({
  status: 'not_registered',
  paymentStatus: null,
  registration: null,
  ...over,
})

const renderCard = ({
  summary = summaryOf(),
  isEventFull = false,
  hasTikkie = false,
  registering = false,
  error = '',
  onRegister = vi.fn(),
  onGoToPayment = vi.fn(),
}: Partial<Parameters<typeof JoinEventCard>[0]> = {}) => {
  render(
    <JoinEventCard
      summary={summary}
      isEventFull={isEventFull}
      hasTikkie={hasTikkie}
      registering={registering}
      error={error}
      onRegister={onRegister}
      onGoToPayment={onGoToPayment}
    />,
  )
  return { onRegister, onGoToPayment }
}

afterEach(cleanup)

describe('JoinEventCard — signing up', () => {
  it('offers registration to a player who has not signed up', () => {
    const { onRegister } = renderCard()

    fireEvent.click(screen.getByRole('button', { name: /register for this event/i }))

    expect(onRegister).toHaveBeenCalledTimes(1)
  })

  it('offers the waitlist instead when the event is full', () => {
    renderCard({ isEventFull: true })

    expect(screen.getByRole('button', { name: /join the waitlist/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /register for this event/i })).toBeNull()
  })

  it('lets a cancelled player sign up again, and says what happened', () => {
    renderCard({ summary: summaryOf({ status: 'cancelled' }) })

    expect(screen.getByText(/registration was cancelled/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: /register again/i })).not.toBeNull()
  })

  it('disables the button while the sign-up is in flight', () => {
    renderCard({ registering: true })

    const button = screen.getByRole('button', { name: /signing up/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  // A failed insert used to leave the card unchanged, so the player read "you
  // haven't signed up yet" as the normal state and just tapped again.
  it('says so when the sign-up failed, and keeps the button usable', () => {
    renderCard({ error: 'Could not sign you up. Please try again.' })

    expect(screen.getByRole('alert').textContent).toMatch(/could not sign you up/i)
    const button = screen.getByRole('button', { name: /register for this event/i })
    expect((button as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows no error on the ordinary path', () => {
    renderCard()

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports a failure to a cancelled player retrying too', () => {
    renderCard({
      summary: summaryOf({ status: 'cancelled' }),
      error: 'Could not sign you up. Please try again.',
    })

    expect(screen.getByRole('alert')).not.toBeNull()
    expect(screen.getByRole('button', { name: /register again/i })).not.toBeNull()
  })
})

describe('JoinEventCard — already in', () => {
  it('reports the waitlist position rather than offering to register again', () => {
    renderCard({ summary: summaryOf({ status: 'waitlisted', waitlistPosition: 3 }) })

    expect(screen.getByText(/on the waitlist · #3/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /register/i })).toBeNull()
  })

  it('confirms a registered player and offers no second sign-up', () => {
    renderCard({ summary: summaryOf({ status: 'registered', paymentStatus: 'unpaid' }) })

    expect(screen.getByText(/you're registered/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /register/i })).toBeNull()
  })

  it('sends an unpaid player to /me rather than repeating the Tikkie flow', () => {
    const { onGoToPayment } = renderCard({
      summary: summaryOf({ status: 'registered', paymentStatus: 'unpaid' }),
      hasTikkie: true,
    })

    fireEvent.click(screen.getByRole('button', { name: /pay on the you tab/i }))

    expect(onGoToPayment).toHaveBeenCalledTimes(1)
  })

  it('asks for no payment on an event that takes none', () => {
    renderCard({
      summary: summaryOf({ status: 'registered', paymentStatus: 'unpaid' }),
      hasTikkie: false,
    })

    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull()
  })

  it('shows confirmed instead of a payment link once paid', () => {
    renderCard({
      summary: summaryOf({ status: 'registered', paymentStatus: 'paid' }),
      hasTikkie: true,
    })

    expect(screen.getByText(/confirmed/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull()
  })
})
