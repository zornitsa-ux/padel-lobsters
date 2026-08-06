// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { NormalisedTournament } from './tournamentQueries'

const mockUseRaffleWinners = vi.fn()
const mockUsePlayers = vi.fn()

vi.mock('../raffle/useRaffle', () => ({ useRaffleWinners: () => mockUseRaffleWinners() }))
vi.mock('../players/usePlayers', () => ({ usePlayers: () => mockUsePlayers() }))

const RaffleWinnersBlock = (await import('./RaffleWinnersBlock')).default

const WINNERS = [
  { id: 'w1', playerId: 'p1', prize: 'Padel balls', tournamentId: 't1' },
  { id: 'w2', playerId: 'p2', prize: 'Grip tape', tournamentId: 't1' },
]

function setup({
  rafflePublishedAt = null,
  isAdmin = false,
  winners = WINNERS,
}: { rafflePublishedAt?: string | null; isAdmin?: boolean; winners?: unknown[] } = {}) {
  mockUseRaffleWinners.mockReturnValue({ data: winners })
  mockUsePlayers.mockReturnValue({
    data: [
      { id: 'p1', name: 'Ada Lovelace' },
      { id: 'p2', name: 'Alan Turing' },
    ],
  })
  const tournament = { id: 't1', rafflePublishedAt } as unknown as NormalisedTournament
  render(<RaffleWinnersBlock tournament={tournament} isAdmin={isAdmin} />)
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('RaffleWinnersBlock — the publish embargo', () => {
  it('DEFECT GUARD — hides a drawn-but-unpublished raffle from players', () => {
    setup({ rafflePublishedAt: null, isAdmin: false })
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
    expect(screen.queryByText(/prize raffle/i)).toBeNull()
  })

  it('shows winners to players once published', () => {
    setup({ rafflePublishedAt: '2026-07-29T21:30:00Z', isAdmin: false })
    expect(screen.queryByText('Ada Lovelace')).not.toBeNull()
    expect(screen.queryByText('Alan Turing')).not.toBeNull()
  })

  it('always shows winners to an admin, published or not', () => {
    setup({ rafflePublishedAt: null, isAdmin: true })
    expect(screen.queryByText('Ada Lovelace')).not.toBeNull()
  })

  it('tells the admin the block is not public yet', () => {
    setup({ rafflePublishedAt: null, isAdmin: true })
    expect(screen.queryByText(/only admins can see this/i)).not.toBeNull()
  })

  it('drops the admin-only notice once published', () => {
    setup({ rafflePublishedAt: '2026-07-29T21:30:00Z', isAdmin: true })
    expect(screen.queryByText(/only admins can see this/i)).toBeNull()
  })
})

describe('RaffleWinnersBlock — empty and naming', () => {
  it('renders nothing at all when no raffle has been drawn', () => {
    setup({ winners: [], rafflePublishedAt: '2026-07-29T21:30:00Z', isAdmin: true })
    expect(screen.queryByText(/prize raffle/i)).toBeNull()
  })

  it('renders nothing for an admin either when there are no winners', () => {
    setup({ winners: [], rafflePublishedAt: null, isAdmin: true })
    expect(screen.queryByText(/prize raffle/i)).toBeNull()
  })

  it('shows the prize beside each winner', () => {
    setup({ rafflePublishedAt: '2026-07-29T21:30:00Z' })
    expect(screen.queryByText('Padel balls')).not.toBeNull()
    expect(screen.queryByText('Grip tape')).not.toBeNull()
  })

  it('falls back gracefully on an unknown player id', () => {
    setup({
      rafflePublishedAt: '2026-07-29T21:30:00Z',
      winners: [{ id: 'w9', playerId: 'ghost', prize: 'Towel', tournamentId: 't1' }],
    })
    expect(screen.queryByText('Unknown player')).not.toBeNull()
  })
})
