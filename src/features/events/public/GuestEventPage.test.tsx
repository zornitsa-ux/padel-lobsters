// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
  usePublicEvents.mockReturnValue({ data: events, isPending: false })

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

  it('points a finished event to upcoming events, with no join', () => {
    loaded([event({ status: 'completed' }, 20)])
    renderAt('/events/evt-1/info')
    expect(screen.getByText('This event has finished')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /join/i })).toBeNull()
  })

  it('sends an unknown event back to the list', () => {
    loaded([])
    renderAt('/events/nope/info')
    expect(screen.getByText('EVENTS LIST')).toBeTruthy()
  })
})
