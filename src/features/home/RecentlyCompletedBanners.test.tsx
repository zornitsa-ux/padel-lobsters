// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import RecentlyCompletedBanners from './RecentlyCompletedBanners'
import { mkMatch, mkRegistration } from '../../test/factories'

afterEach(cleanup)

const players = [
  { id: 'p1', name: 'Ada Lovelace' },
  { id: 'p2', name: 'Grace Hopper' },
]

const matches = [
  mkMatch({
    id: 'm1',
    completed: true,
    score1: 21,
    score2: 10,
    team1Ids: ['p1'],
    team2Ids: ['p2'],
  }),
]

const registrations = [
  mkRegistration({ id: 'r1', playerId: 'p1', status: 'registered' }),
  mkRegistration({ id: 'r2', playerId: 'p2', status: 'registered' }),
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
        {
          id: 't1',
          name: 'Saturday Lobster',
          status: 'completed',
          resultsSharedAt,
          format: 'lobster_matching',
        },
      ]}
      getTournamentMatches={() => matches}
      getTournamentRegistrations={() => registrations}
      players={players}
      teamResults={new Map()}
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

describe('RecentlyCompletedBanners — King of the Court', () => {
  const kotc = {
    id: 'k1',
    name: 'King Sunday',
    status: 'upcoming',
    resultsSharedAt: null,
    format: 'king_of_court',
  }
  const renderKotc = (teamResults: Map<string, unknown[]> | null) => {
    const onNavigate = vi.fn()
    render(
      <RecentlyCompletedBanners
        recentlyCompleted={[kotc]}
        getTournamentMatches={() => []}
        getTournamentRegistrations={() => registrations}
        players={players}
        teamResults={teamResults as never}
        isAdmin={false}
        onNavigate={onNavigate}
      />,
    )
    return onNavigate
  }

  it('names the winning team with no reveal step (D-026)', () => {
    const onNavigate = renderKotc(
      new Map([['k1', [{ teamId: 'tm1', playerIds: ['p1', 'p2'], finalRank: 1 }]]]),
    )

    expect(screen.getByText('Ada Lovelace & Grace Hopper')).toBeTruthy()
    screen.getByRole('button', { name: 'See Full Results' }).click()
    expect(onNavigate).toHaveBeenCalledWith('scores', kotc)
  })

  it('holds the banner back while the teams load', () => {
    renderKotc(null)

    expect(screen.queryByText('King Sunday')).toBeNull()
  })

  it('links to the event when no standings were saved', () => {
    const onNavigate = renderKotc(
      new Map([['k1', [{ teamId: 'tm1', playerIds: ['p1', 'p2'], finalRank: null }]]]),
    )

    expect(screen.queryByText(/winner/i)).toBeNull()
    expect(screen.queryByText(/pending/i)).toBeNull()
    screen.getByRole('button', { name: 'View Event' }).click()
    expect(onNavigate).toHaveBeenCalledWith('registration', kotc)
  })
})
