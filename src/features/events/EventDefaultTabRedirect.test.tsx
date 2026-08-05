// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const useMatches = vi.fn()

vi.mock('./useMatches', () => ({ useMatches: () => useMatches() }))
vi.mock('../oscars/useOscarsSessionRow', () => ({ useOscarsSessionRow: () => ({ data: null }) }))

// The real useEventPhase runs against the mocked queries, so the pending gate is
// covered through the hook rather than around it.
const { default: EventDefaultTabRedirect } = await import('./EventDefaultTabRedirect')

const LIVE_EVENT = {
  id: 'evt-1',
  name: 'Friday Padel',
  status: 'active',
  date: '2020-01-01',
  resultsSharedAt: null,
}

const scored = [{ completed: true, score1: 6, score2: 4 }]
const unscored = [{ completed: false, score1: null, score2: null }]

const pending = () => ({ data: undefined, isPending: true })
const settled = (rows: unknown[]) => ({ data: rows, isPending: false })

function renderRedirect(tournament: Record<string, unknown> = LIVE_EVENT) {
  return render(
    <MemoryRouter initialEntries={['/events/evt-1']}>
      <Routes>
        <Route
          path="/events/:id"
          element={
            <EventDefaultTabRedirect
              tournament={
                tournament as unknown as Parameters<typeof EventDefaultTabRedirect>[0]['tournament']
              }
            />
          }
        />
        <Route path="/events/:id/info" element={<div>INFO TAB</div>} />
        <Route path="/events/:id/me" element={<div>ME TAB</div>} />
        <Route path="/events/:id/results" element={<div>RESULTS TAB</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const infoTab = () => screen.queryByText('INFO TAB')
const meTab = () => screen.queryByText('ME TAB')
const resultsTab = () => screen.queryByText('RESULTS TAB')
const spinner = () => document.querySelector('.animate-spin')

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('EventDefaultTabRedirect', () => {
  // A pending matches query yields [], and zero matches IS phase `open`, so the
  // redirect fired to Info before the schedule had ever arrived. `replace` made
  // it unrecoverable — the player could not go back.
  it('DEFECT GUARD — waits for matches instead of redirecting off a pending phase', () => {
    useMatches.mockReturnValue(pending())

    renderRedirect()

    expect(infoTab()).toBeNull()
    expect(meTab()).toBeNull()
    expect(spinner()).not.toBeNull()
  })

  it('sends a live event to the player’s own tab once matches settle', () => {
    useMatches.mockReturnValue(settled(unscored))

    renderRedirect()

    expect(meTab()).not.toBeNull()
    expect(infoTab()).toBeNull()
  })

  it('sends an event with no schedule to Info', () => {
    useMatches.mockReturnValue(settled([]))

    renderRedirect()

    expect(infoTab()).not.toBeNull()
  })

  it('sends a revealed event to Results', () => {
    useMatches.mockReturnValue(settled(scored))

    renderRedirect({ ...LIVE_EVENT, status: 'completed', resultsSharedAt: '2020-01-02T00:00:00Z' })

    expect(resultsTab()).not.toBeNull()
  })
})
