// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import RecentlyCompletedBanners from './RecentlyCompletedBanners'

afterEach(cleanup)

const players = [
  { id: 'p1', name: 'Ada Lovelace' },
  { id: 'p2', name: 'Grace Hopper' },
]

const matches = [
  {
    completed: true,
    score1: 21,
    score2: 10,
    team1Ids: ['p1'],
    team2Ids: ['p2'],
  },
]

const registrations = [
  { playerId: 'p1', status: 'registered' },
  { playerId: 'p2', status: 'registered' },
]

const renderBanners = ({
  isAdmin,
  resultsSharedAt,
}: {
  isAdmin: boolean
  resultsSharedAt: string | null
}) =>
  render(
    <RecentlyCompletedBanners
      recentlyCompleted={[
        { id: 't1', name: 'Saturday Lobster', status: 'completed', resultsSharedAt },
      ]}
      getTournamentMatches={() => matches}
      getTournamentRegistrations={() => registrations}
      players={players}
      isAdmin={isAdmin}
      onNavigate={vi.fn()}
    />,
  )

describe('RecentlyCompletedBanners — results withheld (D-029)', () => {
  it('hides the winner from a non-admin while pending reveal', () => {
    renderBanners({ isAdmin: false, resultsSharedAt: null })

    expect(screen.getByText(/results pending/i)).toBeTruthy()
    expect(screen.queryByText(/winner/i)).toBeNull()
    expect(screen.getByRole('button', { name: /view matches/i })).toBeTruthy()
  })

  it('shows the winner to an admin even while pending reveal', () => {
    renderBanners({ isAdmin: true, resultsSharedAt: null })

    expect(screen.getByText(/winner/i)).toBeTruthy()
    expect(screen.queryByText(/results pending/i)).toBeNull()
  })

  it('shows the winner to a non-admin once revealed', () => {
    renderBanners({ isAdmin: false, resultsSharedAt: '2026-07-25T00:00:00Z' })

    expect(screen.getByText(/winner/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /see full results/i })).toBeTruthy()
  })
})
