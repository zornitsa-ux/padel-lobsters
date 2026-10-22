// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NormalisedTournament } from '../../../../lib/normalise'

const m = vi.hoisted(() => ({
  useApp: vi.fn(),
  registerTeam: vi.fn(),
  changeTeamPartner: vi.fn(),
  adminCancelTeam: vi.fn(),
  adminPromoteTeam: vi.fn(),
  confirm: vi.fn(),
  teams: [] as unknown[],
  invites: [] as unknown[],
}))

vi.mock('../../../../context/useApp', () => ({ useApp: () => m.useApp() }))
vi.mock('../../useTournaments', () => ({ useUpdateTournament: () => ({ mutateAsync: vi.fn() }) }))
vi.mock('../../useTransfers', () => ({
  useTransfers: () => ({ data: [] }),
  useTransferActions: () => ({}),
}))
vi.mock('../../../players/usePlayers', () => ({ usePlayers: () => ({ data: players }) }))
vi.mock('../../useRegistrations', () => ({
  useRegistrations: () => ({ data: registrations }),
  useRegistrationActions: () => ({
    registerPlayer: vi.fn(),
    updateRegistration: vi.fn(),
    cancelRegistration: vi.fn(),
    promoteWaitlistRegistration: vi.fn(),
  }),
}))
vi.mock('../../teams/useTeams', () => ({
  useEventTeams: () => ({ data: m.teams }),
  usePartnerInvites: () => ({ data: m.invites }),
  useTeamActions: () => ({
    registerTeam: m.registerTeam,
    changeTeamPartner: m.changeTeamPartner,
    adminCancelTeam: m.adminCancelTeam,
    adminPromoteTeam: m.adminPromoteTeam,
  }),
}))
vi.mock('../../../../lib/confirmBus', () => ({ useConfirm: () => m.confirm }))
vi.mock('../../../../lib/toastBus', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('../../../settings/useSettings', () => ({
  useSettings: () => ({ data: { whatsappLink: '' } }),
}))

const Registration = (await import('../../Registration')).default

const player = (id: string, name: string, status = 'active') => ({
  id,
  name,
  status,
  playtomicLevel: 3,
})
const players = [
  player('me', 'Alma'),
  player('p1', 'Bob'),
  player('p2', 'Cara'),
  player('p3', 'Dan'),
  player('p4', 'Eve'),
  player('p5', 'Finn'),
  player('ghost', 'Pia', 'placeholder'),
]

const reg = (id: string, playerId: string, teamId: string | null, status: string) => ({
  id,
  playerId,
  tournamentId: 't1',
  status,
  teamId,
  paymentStatus: 'unpaid',
  registeredAt: { seconds: 1 },
})

let registrations: unknown[] = []

const team = (id: string, captainId: string, createdAt: string) => ({
  id,
  tournamentId: 't1',
  captainId,
  seed: null,
  finalRank: null,
  createdAt,
})

const teamTournament = {
  id: 't1',
  name: 'Team Friday',
  date: '2026-12-01',
  time: '19:00',
  location: 'Padel Inc',
  status: 'upcoming',
  format: 'lobster_matching',
  entryMode: 'team',
  notes: '',
  maxPlayers: 8,
  duration: 90,
  courts: [],
  totalPrice: 80,
  tikkieLink: '',
  genderMode: 'mixed',
} as unknown as NormalisedTournament

function renderInfo({
  isAdmin = false,
  tournament = teamTournament,
}: { isAdmin?: boolean; tournament?: NormalisedTournament } = {}) {
  m.useApp.mockReturnValue({ session: { user: { id: 'me' } }, role: 'player', isAdmin })
  render(
    <MemoryRouter>
      <Registration tournament={tournament} onNavigate={vi.fn()} />
    </MemoryRouter>,
  )
}

const openNewPartnerForm = () => {
  fireEvent.click(screen.getByRole('button', { name: /sign up as a team/i }))
  fireEvent.click(screen.getByRole('button', { name: /isn't on padel lobsters/i }))
}

const fillNewPartner = () => {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Gus' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'gus@example.com' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  m.teams = [team('tm1', 'p2', '2026-10-01T10:00:00Z')]
  m.invites = []
  registrations = [reg('r1', 'p2', 'tm1', 'registered'), reg('r2', 'p3', 'tm1', 'registered')]
  m.confirm.mockResolvedValue(true)
})
afterEach(cleanup)

describe('team join card', () => {
  it('keeps submit disabled until consent is ticked and name and email are filled', () => {
    renderInfo()
    openNewPartnerForm()
    expect(screen.getByText(/creating a padel lobsters account for your partner/i)).not.toBeNull()
    const submit = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement

    fillNewPartner()
    expect(submit.disabled).toBe(true)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(submit.disabled).toBe(false)
  })

  it('searches active members only, excluding placeholders, entered players and yourself', () => {
    renderInfo()
    fireEvent.click(screen.getByRole('button', { name: /sign up as a team/i }))

    const names = screen
      .getAllByRole('button', { pressed: false })
      .map((b) => b.textContent ?? '')
      .join('|')
    expect(names).toContain('Bob')
    expect(names).toContain('Eve')
    for (const excluded of ['Pia', 'Cara', 'Dan', 'Alma']) expect(names).not.toContain(excluded)
  })

  it('shows email_in_use inline', async () => {
    m.registerTeam.mockResolvedValue({ status: 'email_in_use', teamId: null, partnerId: null })
    renderInfo()
    openNewPartnerForm()
    fillNewPartner()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText(/you \+ gus · €20\.00 for the team/i)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/already has an account/i)
    expect(m.registerTeam).toHaveBeenCalledWith({
      tournamentId: 't1',
      captainId: 'me',
      choice: {
        kind: 'new',
        partner: { name: 'Gus', email: 'gus@example.com', playtomicLevel: null },
        consent: true,
      },
    })
  })

  it('tells a new partner how to sign in once registered', async () => {
    m.registerTeam.mockResolvedValue({ status: 'registered', teamId: 'tm9', partnerId: 'x' })
    renderInfo()
    openNewPartnerForm()
    fillNewPartner()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(
      await screen.findByText(
        'Gus can sign in with gus@example.com any time to see the event. Let them know!',
      ),
    ).not.toBeNull()
  })

  it('says both are on the waitlist when the team lands there', async () => {
    m.registerTeam.mockResolvedValue({ status: 'waitlist', teamId: 'tm9', partnerId: 'p1' })
    renderInfo()
    fireEvent.click(screen.getByRole('button', { name: /sign up as a team/i }))
    fireEvent.click(screen.getByRole('button', { name: /bob/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: /sign up|join the waitlist/i }))

    expect(await screen.findByText("You're both on the waitlist.")).not.toBeNull()
  })
})

describe('team lists and card', () => {
  it('renders teams as "A & B" and no transfer UI', () => {
    renderInfo()

    expect(screen.getByText('Cara & Dan')).not.toBeNull()
    expect(screen.queryByText(/transfer/i)).toBeNull()
  })

  it('shows the partner their team card with covered payment and no change control', () => {
    registrations = [reg('r1', 'p1', 'tm1', 'registered'), reg('r2', 'me', 'tm1', 'registered')]
    m.teams = [team('tm1', 'p1', '2026-10-01T10:00:00Z')]
    renderInfo()

    expect(screen.getByText('You & Bob')).not.toBeNull()
    expect(screen.getByText(/covered by bob/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: /change partner/i })).toBeNull()
  })

  it('lets the captain change partner and shows the message inline', async () => {
    registrations = [reg('r1', 'me', 'tm1', 'registered'), reg('r2', 'p1', 'tm1', 'registered')]
    m.teams = [team('tm1', 'me', '2026-10-01T10:00:00Z')]
    m.changeTeamPartner.mockResolvedValue({ status: 'change_closed', partnerId: null })
    renderInfo()

    fireEvent.click(screen.getByRole('button', { name: 'Change partner' }))
    fireEvent.click(screen.getByRole('button', { name: /eve/i }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Change partner' }).pop()!)

    expect((await screen.findByRole('alert')).textContent).toMatch(/close 12 hours/i)
  })
})

describe('admin team actions', () => {
  beforeEach(() => {
    m.teams = [team('tm1', 'p2', '2026-10-01T10:00:00Z'), team('tm2', 'p4', '2026-10-02T10:00:00Z')]
    registrations = [
      reg('r1', 'p2', 'tm1', 'registered'),
      reg('r2', 'p3', 'tm1', 'registered'),
      reg('r3', 'p4', 'tm2', 'waitlist'),
      reg('r4', 'p5', 'tm2', 'waitlist'),
    ]
    m.adminCancelTeam.mockResolvedValue({ status: 'cancelled', promotedTeamId: null })
  })

  it('cancels a whole team', async () => {
    renderInfo({ isAdmin: true })

    fireEvent.click(screen.getAllByRole('button', { name: 'Cancel team' })[0])

    await waitFor(() =>
      expect(m.adminCancelTeam).toHaveBeenCalledWith({ tournamentId: 't1', teamId: 'tm1' }),
    )
  })

  it('confirms a waitlisted team', () => {
    renderInfo({ isAdmin: true })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(m.adminPromoteTeam).toHaveBeenCalledWith({ tournamentId: 't1', teamId: 'tm2' })
  })

  it("hints at partners who haven't signed in yet", () => {
    m.invites = [{ playerId: 'p3', lastSignInAt: null }]
    renderInfo({ isAdmin: true })

    expect(screen.getAllByText(/hasn't signed in yet/i)).toHaveLength(1)
  })

  it('adds a team for a chosen captain', async () => {
    m.registerTeam.mockResolvedValue({ status: 'registered', teamId: 'tm9', partnerId: 'p1' })
    renderInfo({ isAdmin: true })

    fireEvent.click(screen.getByRole('button', { name: /add team/i }))
    fireEvent.click(screen.getByRole('button', { name: /alma/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: /bob/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add team' }))

    await waitFor(() =>
      expect(m.registerTeam).toHaveBeenCalledWith({
        tournamentId: 't1',
        captainId: 'me',
        choice: { kind: 'member', playerId: 'p1' },
      }),
    )
  })
})

describe('individual events', () => {
  it('render the single-player join card and no team controls', () => {
    registrations = []
    renderInfo({
      tournament: { ...teamTournament, entryMode: 'individual' } as NormalisedTournament,
    })

    expect(screen.getByRole('button', { name: /register for this event/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /sign up as a team/i })).toBeNull()
  })
})
