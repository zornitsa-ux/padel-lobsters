// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NormalisedTournament } from '../../lib/normalise'

/* ════════════════════════════════════════════════════════════════════════════
   The Info tab is about the event and only the event.

   It used to render `ScoresAndRankingSection`, whose podium and standings
   appeared on `(allScored || isCompleted)` — so the final ranking leaked the
   instant the last score was typed, while the admin was still on court, and it
   never imported `resultsWithheld()`. The whole section is deleted rather than
   guarded; Results owns rankings. These assertions pin that it stays deleted at
   every phase.
   ════════════════════════════════════════════════════════════════════════════ */

const mockUseApp = vi.fn()

vi.mock('../../context/useApp', () => ({ useApp: () => mockUseApp() }))
vi.mock('./useTournaments', () => ({
  useUpdateTournament: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./useTransfers', () => ({
  useTransfers: () => ({ data: [] }),
  useTransferActions: () => ({}),
}))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('./useRegistrations', () => ({
  useRegistrations: () => ({ data: registrations }),
  useRegistrationActions: () => ({
    registerPlayer: vi.fn(),
    updateRegistration: vi.fn(),
    cancelRegistration: vi.fn(),
  }),
}))
vi.mock('../../lib/confirmBus', () => ({ useConfirm: () => vi.fn() }))

const Registration = (await import('./Registration')).default

const players = Array.from({ length: 4 }, (_, i) => ({
  id: `p${i}`,
  name: `Player ${i}`,
  playtomicLevel: 3,
}))

const allRegistered = () =>
  players.map((p, i) => ({
    id: `r${i}`,
    playerId: p.id,
    tournamentId: 't1',
    status: 'registered',
    paymentStatus: 'paid',
    registeredAt: { seconds: i },
  }))

// Reassigned per test; the mock factory reads it lazily.
let registrations: unknown[] = allRegistered()

const baseTournament = {
  id: 't1',
  name: 'Friday Padel',
  date: '2026-07-29',
  time: '19:00',
  location: 'Padel Inc',
  status: 'active',
  format: 'lobster_matching',
  notes: 'Bring water',
  maxPlayers: 8,
  duration: 90,
  courts: [],
  courtBookingMode: 'admin_all',
  totalPrice: 0,
  tikkieLink: '',
  genderMode: 'mixed',
  completedAt: null,
  resultsSharedAt: null,
  rafflePublishedAt: null,
} as unknown as NormalisedTournament

function renderInfo({
  isAdmin = false,
  ...overrides
}: { isAdmin?: boolean } & Partial<NormalisedTournament> = {}) {
  mockUseApp.mockReturnValue({
    session: { user: { app_metadata: { role: isAdmin ? 'admin' : 'player' }, id: 'p0' } },
  })
  render(
    <MemoryRouter>
      <Registration
        tournament={{ ...baseTournament, ...overrides } as NormalisedTournament}
        onNavigate={vi.fn()}
      />
    </MemoryRouter>,
  )
}

// Every phase the event can be in, including the two that caused the leak.
const PHASES: Array<[string, Partial<NormalisedTournament>]> = [
  ['open', { status: 'upcoming' }],
  ['live', { status: 'active' }],
  ['sealed (all scored, not completed)', { status: 'active' }],
  ['social (completed, not shared)', { status: 'completed', resultsSharedAt: null }],
  [
    'revealed (completed and shared)',
    { status: 'completed', resultsSharedAt: '2026-07-29T21:00:00Z' },
  ],
]

beforeEach(() => {
  vi.clearAllMocks()
  registrations = allRegistered()
})
afterEach(cleanup)

describe('Info tab — no results leak at any phase', () => {
  it.each(PHASES)('renders no podium, standings or ranking at %s', (_label, overrides) => {
    for (const isAdmin of [false, true]) {
      renderInfo({ isAdmin, ...overrides })

      expect(screen.queryByText(/podium/i)).toBeNull()
      expect(screen.queryByText(/final ranking/i)).toBeNull()
      expect(screen.queryByText(/standings/i)).toBeNull()
      expect(screen.queryByText(/🥇/)).toBeNull()
      expect(screen.queryByText(/points/i)).toBeNull()
      cleanup()
    }
  })

  it('DEFECT GUARD — offers no completion control', () => {
    // The second Finish button lived here and skipped applyTournamentRatings.
    renderInfo({ isAdmin: true, status: 'active' })

    expect(screen.queryByRole('button', { name: /mark tournament as complete/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /finish tournament/i })).toBeNull()
  })

  it('DEFECT GUARD — offers no Lobster Games button', () => {
    // The player's only Oscars door used to be here, wrapped in `!isCompleted`,
    // so Finish closed it. Oscars is a phase-gated tab now.
    renderInfo({ status: 'completed' })

    expect(screen.queryByText(/lobster games/i)).toBeNull()
  })

  it('offers no reveal control — that belongs to the run-of-show', () => {
    renderInfo({ isAdmin: true, status: 'completed', resultsSharedAt: null })

    expect(screen.queryByRole('button', { name: /reveal results/i })).toBeNull()
  })
})

describe('Info tab — the event, and only the event', () => {
  it('shows date, time, location and format', () => {
    renderInfo()

    expect(screen.queryByText('19:00 · 90min')).not.toBeNull()
    expect(screen.queryByText('Padel Inc')).not.toBeNull()
    expect(screen.queryByText(/format:/i)).not.toBeNull()
  })

  it('reduces the roster to two numbers', () => {
    renderInfo()

    // "4 of 8 · 0 waiting" rather than the old four-up Registered/Waitlist/
    // Max/Spots-left bar.
    expect(screen.queryByText(/4 of 8/)).not.toBeNull()
    expect(screen.queryByText(/spots left/i)).toBeNull()
  })

  it('still lists the roster', () => {
    renderInfo()

    // Names render through Registration's own `displayName` shortener, so match
    // loosely rather than pinning its output.
    expect(screen.queryAllByText(/Player/).length).toBeGreaterThan(0)
  })

  it('keeps rendering after the tournament completes', () => {
    renderInfo({ status: 'completed' })

    expect(screen.queryByText('Padel Inc')).not.toBeNull()
  })
})

describe('Info tab — players sign themselves up here', () => {
  // p0 is the signed-in viewer in `renderInfo`.
  const withoutViewer = () => allRegistered().filter((r) => r.playerId !== 'p0')

  it('offers registration to a signed-in player who has not joined', () => {
    registrations = withoutViewer()

    renderInfo()

    expect(screen.getByRole('button', { name: /register for this event/i })).not.toBeNull()
  })

  it('offers the waitlist once the roster is full', () => {
    registrations = withoutViewer()

    renderInfo({ maxPlayers: 3 })

    expect(screen.getByRole('button', { name: /join the waitlist/i })).not.toBeNull()
  })

  it('confirms rather than re-offers when the viewer is already registered', () => {
    renderInfo()

    expect(screen.getByText(/you're registered/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /register for this event/i })).toBeNull()
  })

  it('offers no self-registration once the event is over', () => {
    registrations = withoutViewer()

    renderInfo({ status: 'completed' })

    expect(screen.queryByRole('button', { name: /register for this event/i })).toBeNull()
  })

  it('leaves admins the add-player flow, not a self-registration button', () => {
    registrations = withoutViewer()

    renderInfo({ isAdmin: true })

    expect(screen.queryByRole('button', { name: /register for this event/i })).toBeNull()
  })
})

describe('Info tab — share and calendar sit with the date', () => {
  it('puts both chips inside the date and time card', () => {
    renderInfo()

    const share = screen.getByTitle('Share on WhatsApp')
    const calendar = screen.getByTitle('Add to Google Calendar')
    // The meta card is the one holding the location; both chips live in it.
    const metaCard = screen.getByText('Padel Inc').closest('.card')

    expect(metaCard).not.toBeNull()
    expect(metaCard?.contains(share)).toBe(true)
    expect(metaCard?.contains(calendar)).toBe(true)
  })
})
