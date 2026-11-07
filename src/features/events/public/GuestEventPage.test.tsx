// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { normaliseTournaments } from '../../../lib/normalise'
import type { PublicEvent } from './publicEventQueries'

const usePublicEvents = vi.fn()
vi.mock('./usePublicEvents', () => ({ usePublicEvents: () => usePublicEvents() }))

const { GuestEventShell, GuestEventInfo } = await import('./GuestEventPage')

const event = (raw: Record<string, unknown>, registeredCount: number): PublicEvent => ({
  ...normaliseTournaments([
    {
      id: 'evt-1',
      name: 'Sunday mix',
      date: '2099-11-15',
      status: 'upcoming',
      max_players: 20,
      total_price: 200,
      notes: 'Bring water.',
      ...raw,
    },
  ])[0],
  registeredCount,
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/events" element={<div>EVENTS LIST</div>} />
        <Route path="/events/:id" element={<GuestEventShell />}>
          <Route path="info" element={<GuestEventInfo />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const loaded = (events: PublicEvent[]) =>
  usePublicEvents.mockReturnValue({ data: events, isPending: false, isError: false })

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('guest event page', () => {
  it('shows the facts and a join link into signup', () => {
    loaded([event({}, 17)])
    renderAt('/events/evt-1/info')
    expect(screen.getAllByText('Sunday mix').length).toBeGreaterThan(0)
    expect(screen.getByText('3 spots left')).toBeTruthy()
    expect(screen.getByText('€10.00 pp')).toBeTruthy()
    expect(screen.getByText('Bring water.')).toBeTruthy()
    const join = screen.getByRole('link', { name: /join to play/i })
    expect(join.getAttribute('href')).toBe('/events/evt-1/join?signup=1')
    expect(screen.getByRole('link', { name: /sign in/i }).getAttribute('href')).toBe(
      '/events/evt-1/join',
    )
  })

  it('offers the waitlist when full', () => {
    loaded([event({}, 20)])
    renderAt('/events/evt-1/info')
    expect(screen.getByText('This event is full')).toBeTruthy()
    expect(screen.getByRole('link', { name: /join to get on the waitlist/i })).toBeTruthy()
  })

  it('closes sign-ups on a finished event, pointing to upcoming events, with no join', () => {
    loaded([event({ status: 'completed' }, 20)])
    renderAt('/events/evt-1/info')
    expect(screen.getByText('Sign-ups are closed')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /join/i })).toBeNull()
  })

  it('keeps the URL and shows an error when the load fails', () => {
    usePublicEvents.mockReturnValue({ data: undefined, isPending: false, isError: true })
    renderAt('/events/evt-1/info')
    expect(screen.getByText(/couldn.t load this event/i)).toBeTruthy()
    expect(screen.queryByText('EVENTS LIST')).toBeNull()
  })

  it('closes sign-ups once the event has started', () => {
    loaded([event({ status: 'active' }, 10)])
    renderAt('/events/evt-1/info')
    expect(screen.getByText('Sign-ups are closed')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /join/i })).toBeNull()
  })

  it('sends an unknown event back to the list', () => {
    loaded([])
    renderAt('/events/nope/info')
    expect(screen.getByText('EVENTS LIST')).toBeTruthy()
  })

  it('lets a guest share an open event, with spots left and no player names', () => {
    loaded([event({}, 17)])
    renderAt('/events/evt-1/info')
    fireEvent.click(screen.getByRole('button', { name: 'Share event' }))
    const message = screen.getByTestId('share-message').textContent
    expect(message).toContain('✅ 3 spots left')
    expect(message).toContain(`Sign up: ${window.location.origin}/events/evt-1`)
  })

  it('offers no share once sign-ups close', () => {
    loaded([event({ status: 'completed' }, 20)])
    renderAt('/events/evt-1/info')
    expect(screen.queryByRole('button', { name: 'Share event' })).toBeNull()
  })
})
