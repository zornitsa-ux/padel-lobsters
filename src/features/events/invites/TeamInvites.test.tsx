// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

const m = vi.hoisted(() => ({
  respondToTeamInvite: vi.fn(),
  confirm: vi.fn(),
  invites: [] as unknown[],
  session: { user: { id: 'me' } } as { user: { id: string } } | null,
}))

vi.mock('../../../context/useApp', () => ({ useApp: () => ({ session: m.session }) }))
vi.mock('../../../lib/confirmBus', () => ({ useConfirm: () => m.confirm }))
vi.mock('../teams/useTeams', () => ({
  useMyTeamInvites: () => ({ data: m.invites, isPending: false }),
  useTeamActions: () => ({ respondToTeamInvite: m.respondToTeamInvite }),
}))

const TeamInvitesPage = (await import('./TeamInvitesPage')).default
const TeamInviteRedirect = (await import('./TeamInviteRedirect')).default

const invite = (overrides: Record<string, unknown> = {}) => ({
  teamId: 'tm1',
  tournamentId: 't1',
  tournamentName: 'King Sunday',
  tournamentDate: '2026-11-15',
  tournamentTime: '10:00',
  captainId: 'c1',
  captainName: 'Cara',
  teamStatus: 'registered',
  accountCreatedByCaptain: false,
  ...overrides,
})

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/team-invites']}>
      <Routes>
        <Route path="/team-invites" element={<TeamInvitesPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  m.session = { user: { id: 'me' } }
  m.invites = [invite()]
  m.confirm.mockResolvedValue(true)
  window.sessionStorage.clear()
})
afterEach(cleanup)

describe('acceptance screen', () => {
  it('lists the invite with the complete-teams note', () => {
    renderPage()

    expect(
      screen.getByText(/cara has entered you as their partner for king sunday on/i),
    ).not.toBeNull()
    expect(screen.getByText(/we keep spots for complete teams/i)).not.toBeNull()
  })

  it('goes to the event after accepting a regular invite', async () => {
    m.respondToTeamInvite.mockResolvedValue('accepted')
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    expect((await screen.findByTestId('where')).textContent).toBe('/events/t1/info')
    expect(m.respondToTeamInvite).toHaveBeenCalledWith({
      tournamentId: 't1',
      teamId: 'tm1',
      accept: true,
    })
  })

  it('offers an optional profile step to an account the captain created', async () => {
    m.invites = [invite({ accountCreatedByCaptain: true })]
    m.respondToTeamInvite.mockResolvedValue('accepted')
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    const finish = await screen.findByRole('link', { name: 'Finish your profile' })
    expect(finish.getAttribute('href')).toBe('/account')
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect((await screen.findByTestId('where')).textContent).toBe('/events/t1/info')
  })

  it('confirms before declining', async () => {
    m.respondToTeamInvite.mockResolvedValue('declined')
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: "I'm not playing" }))

    await waitFor(() =>
      expect(m.respondToTeamInvite).toHaveBeenCalledWith({
        tournamentId: 't1',
        teamId: 'tm1',
        accept: false,
      }),
    )
    expect(m.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/team will be cancelled|team is cancelled/i),
      }),
    )
  })

  it('leaves with Not now without answering', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(screen.getByTestId('where').textContent).toBe('/home')
    expect(m.respondToTeamInvite).not.toHaveBeenCalled()
  })

  it('asks a signed-out visitor to sign in', () => {
    m.session = null
    renderPage()

    expect(screen.getByText('Sign in to see your team invites')).not.toBeNull()
  })
})

describe('invite redirect', () => {
  const renderApp = () =>
    render(
      <MemoryRouter initialEntries={['/home']}>
        <TeamInviteRedirect />
        <Where />
      </MemoryRouter>,
    )

  it('sends a player with pending invites to the screen once per session', () => {
    const first = renderApp()
    expect(screen.getByTestId('where').textContent).toBe('/team-invites')
    first.unmount()

    renderApp()
    expect(screen.getByTestId('where').textContent).toBe('/home')
  })

  it('does nothing without invites or a session', () => {
    m.invites = []
    renderApp()
    expect(screen.getByTestId('where').textContent).toBe('/home')
    cleanup()

    m.invites = [invite()]
    m.session = null
    renderApp()
    expect(screen.getByTestId('where').textContent).toBe('/home')
  })

  it('returns to the interrupted page on Not now', () => {
    render(
      <MemoryRouter initialEntries={['/events/t9/info?tab=list']}>
        <TeamInviteRedirect />
        <Routes>
          <Route path="/team-invites" element={<TeamInvitesPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(screen.getByTestId('where').textContent).toBe('/events/t9/info')
  })

  it('still redirects another player who signs in on the same tab', () => {
    render(
      <MemoryRouter initialEntries={['/home']}>
        <TeamInviteRedirect />
        <Where />
        <Link to="/home">home</Link>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('where').textContent).toBe('/team-invites')

    fireEvent.click(screen.getByRole('link', { name: 'home' }))
    expect(screen.getByTestId('where').textContent).toBe('/home')

    m.session = { user: { id: 'someone-else' } }
    fireEvent.click(screen.getByRole('link', { name: 'home' }))
    expect(screen.getByTestId('where').textContent).toBe('/team-invites')
  })

  it('cannot loop when sessionStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(
      <MemoryRouter initialEntries={['/home']}>
        <TeamInviteRedirect />
        <Routes>
          <Route path="/team-invites" element={<Where />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('where').textContent).toBe('/team-invites')
    vi.restoreAllMocks()
  })
})
