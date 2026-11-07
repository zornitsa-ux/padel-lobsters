// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithClient } from '../../test/renderWithClient'
import GuestHome from './GuestHome'

const { publicEvents } = vi.hoisted(() => ({ publicEvents: vi.fn() }))
vi.mock('../events/public/usePublicEvents', () => ({ usePublicEvents: publicEvents }))
vi.mock('../settings/useSettings', () => ({
  useSettings: () => ({ data: { padelTips: ['Bend your knees'] } }),
}))
vi.mock('../league/ui/GuestLeagueCard', () => ({ GuestLeagueCard: () => null }))
// Member-only reads must not run for a guest.
vi.mock('../events/useTournaments', () => ({
  useTournaments: () => {
    throw new Error('member query on guest Home')
  },
}))
vi.mock('../events/useRegistrations', () => ({
  useAllRegistrations: () => {
    throw new Error('member query on guest Home')
  },
}))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => {
    throw new Error('member query on guest Home')
  },
}))

afterEach(cleanup)

const renderGuestHome = () =>
  renderWithClient(
    <MemoryRouter>
      <GuestHome onNavigate={vi.fn()} />
    </MemoryRouter>,
  )

describe('GuestHome', () => {
  it('shows the welcome, tip and next public event', () => {
    publicEvents.mockReturnValue({
      data: [
        {
          id: 'e1',
          name: 'Lobster Social',
          date: '2099-03-01',
          time: '18:00',
          status: 'upcoming',
          maxPlayers: 16,
          registeredCount: 4,
        },
      ],
      isPending: false,
      isError: false,
    })
    renderGuestHome()
    expect(screen.getByText(/welcome to padel lobsters/i)).toBeTruthy()
    expect(screen.getByText('Bend your knees')).toBeTruthy()
    expect(screen.getByText('Lobster Social')).toBeTruthy()
  })

  it('says so when events fail to load', () => {
    publicEvents.mockReturnValue({ data: undefined, isPending: false, isError: true })
    renderGuestHome()
    expect(screen.getByText(/upcoming events couldn.t load/i)).toBeTruthy()
  })
})
