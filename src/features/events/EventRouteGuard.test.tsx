// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const useTournaments = vi.fn()
const useApp = vi.fn()

vi.mock('./useTournaments', () => ({ useTournaments: () => useTournaments() }))
vi.mock('./useEventDataLoader', () => ({ useEventDataLoader: () => undefined }))
// Exercises the real hook against a mocked query so the pending/not-found split
// is covered end to end, not stubbed out.
vi.mock('../../context/useApp', () => ({ useApp: () => useApp() }))

const { EventRouteGuard, AdminEventRouteGuard } = await import('./EventRouteGuard')

const EVENT = { id: 'evt-1', name: 'Friday Padel' }

// react-query's shape for the three states the guard has to tell apart.
const pending = () => ({ data: undefined, isPending: true })
const settled = (rows: unknown[]) => ({ data: rows, isPending: false })

function renderAt(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/events" element={<div>EVENTS LIST</div>} />
        <Route path="/events/:id/info" element={<div>INFO TAB</div>} />
        <Route path="/events/:id/schedule" element={element} />
      </Routes>
    </MemoryRouter>,
  )
}

const child = (t: { name: string }) => <div>SCHEDULE for {t.name}</div>

const eventsList = () => screen.queryByText('EVENTS LIST')
const infoTab = () => screen.queryByText('INFO TAB')
const scheduleTab = () => screen.queryByText(/SCHEDULE for/)
const spinner = () => document.querySelector('.animate-spin')

beforeEach(() => {
  useApp.mockReturnValue({ session: null })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('EventRouteGuard — deep link loading vs not-found', () => {
  it('DEFECT GUARD — renders the fallback while the query is pending and does NOT redirect', () => {
    useTournaments.mockReturnValue(pending())

    // The cold-deep-link case: a WhatsApp link, a bookmark, a refresh, an
    // invite. This redirected to /events before the list had even arrived.
    renderAt('/events/evt-1/schedule', <EventRouteGuard>{child}</EventRouteGuard>)

    expect(eventsList()).toBeNull()
    expect(scheduleTab()).toBeNull()
    expect(spinner()).not.toBeNull()
  })

  it('renders the route once the query settles with the id present', () => {
    useTournaments.mockReturnValue(settled([EVENT]))

    renderAt('/events/evt-1/schedule', <EventRouteGuard>{child}</EventRouteGuard>)

    expect(scheduleTab()?.textContent).toBe('SCHEDULE for Friday Padel')
    expect(eventsList()).toBeNull()
  })

  it('redirects to /events once settled and the id genuinely is absent', () => {
    useTournaments.mockReturnValue(settled([{ id: 'other-event', name: 'Other' }]))

    renderAt('/events/evt-1/schedule', <EventRouteGuard>{child}</EventRouteGuard>)

    expect(eventsList()).not.toBeNull()
  })

  it('distinguishes an empty pending list from an empty settled one', () => {
    useTournaments.mockReturnValue(pending())
    const { unmount } = renderAt(
      '/events/evt-1/schedule',
      <EventRouteGuard>{child}</EventRouteGuard>,
    )
    expect(eventsList()).toBeNull()
    unmount()

    useTournaments.mockReturnValue(settled([]))
    renderAt('/events/evt-1/schedule', <EventRouteGuard>{child}</EventRouteGuard>)
    expect(eventsList()).not.toBeNull()
  })

  it('matches ids across string/number types', () => {
    useTournaments.mockReturnValue(settled([{ id: 1, name: 'Numeric' }]))

    renderAt('/events/1/schedule', <EventRouteGuard>{child}</EventRouteGuard>)

    expect(scheduleTab()?.textContent).toBe('SCHEDULE for Numeric')
  })
})

describe('AdminEventRouteGuard', () => {
  const adminSession = { session: { user: { app_metadata: { role: 'admin' }, id: 'u1' } } }
  const playerSession = { session: { user: { app_metadata: { role: 'player' }, id: 'u2' } } }

  it('renders for an admin once settled', () => {
    useTournaments.mockReturnValue(settled([EVENT]))
    useApp.mockReturnValue(adminSession)

    renderAt('/events/evt-1/schedule', <AdminEventRouteGuard>{child}</AdminEventRouteGuard>)

    expect(scheduleTab()?.textContent).toBe('SCHEDULE for Friday Padel')
  })

  it('sends a non-admin to the event Info tab, not to /events', () => {
    useTournaments.mockReturnValue(settled([EVENT]))
    useApp.mockReturnValue(playerSession)

    renderAt('/events/evt-1/schedule', <AdminEventRouteGuard>{child}</AdminEventRouteGuard>)

    expect(infoTab()).not.toBeNull()
    expect(eventsList()).toBeNull()
  })

  it('shows the fallback while pending rather than bouncing a non-admin', () => {
    useTournaments.mockReturnValue(pending())
    useApp.mockReturnValue(playerSession)

    renderAt('/events/evt-1/schedule', <AdminEventRouteGuard>{child}</AdminEventRouteGuard>)

    expect(infoTab()).toBeNull()
    expect(eventsList()).toBeNull()
    expect(spinner()).not.toBeNull()
  })
})
