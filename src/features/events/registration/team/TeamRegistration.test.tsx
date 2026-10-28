// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NormalisedTournament } from '../../../../lib/normalise'

const m = vi.hoisted(() => ({
  useApp: vi.fn(),
  registerTeam: vi.fn(),
  checkEmail: vi.fn(),
  changeTeamPartner: vi.fn(),
  adminCancelTeam: vi.fn(),
  adminPromoteTeam: vi.fn(),
  cancelMyTeam: vi.fn(),
  respondToTeamInvite: vi.fn(),
  confirm: vi.fn(),
  teams: [] as unknown[],
  invites: [] as unknown[],
}))

vi.mock('../../../../context/useApp', () => ({ useApp: () => m.useApp() }))
vi.mock('../../useTournaments', () => ({
  useUpdateTournament: () => ({ mutateAsync: vi.fn() }),
  useAddTournament: () => ({ mutateAsync: vi.fn() }),
}))
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
vi.mock('../../teams/useTeams', async () => {
  const { buildTeamEntries } = await import('../../teams/teamEntries')
  return {
    useTeamEntries: ({
      registrations,
    }: {
      registrations: Parameters<typeof buildTeamEntries>[0]['registrations']
    }) => ({
      teams: m.teams,
      entries: buildTeamEntries({ teams: m.teams as never, registrations }),
    }),
    usePartnerInvites: () => ({ data: m.invites }),
    useTeamActions: () => ({
      registerTeam: m.registerTeam,
      changeTeamPartner: m.changeTeamPartner,
      adminCancelTeam: m.adminCancelTeam,
      adminPromoteTeam: m.adminPromoteTeam,
      cancelMyTeam: m.cancelMyTeam,
      respondToTeamInvite: m.respondToTeamInvite,
    }),
    useCheckNewPartnerEmail: () => m.checkEmail,
  }
})
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
  player('p6', 'Nico Lee'),
  player('p7', 'Nico Stone'),
  player('ghost', 'Pia', 'placeholder'),
]

const reg = (
  id: string,
  playerId: string,
  teamId: string | null,
  status: string,
  acceptedAt: string | null = '2026-10-01T10:00:00Z',
) => ({
  id,
  playerId,
  tournamentId: 't1',
  status,
  teamId,
  acceptedAt,
  paymentStatus: 'unpaid',
  registeredAt: { seconds: 1 },
})

let registrations: unknown[] = []

const team = (
  id: string,
  captainId: string,
  createdAt: string,
  cancelledReason: string | null = null,
) => ({
  id,
  tournamentId: 't1',
  captainId,
  seed: null,
  finalRank: null,
  createdAt,
  cancelledAt: cancelledReason ? createdAt : null,
  cancelledReason,
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
  const ui = () => (
    <MemoryRouter>
      <Registration tournament={tournament} onNavigate={vi.fn()} />
    </MemoryRouter>
  )
  const { rerender } = render(ui())
  return { rerender: () => rerender(ui()) }
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
  m.checkEmail.mockResolvedValue('ok')
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

  it('shows players full names, so members who share a first name can be told apart', () => {
    renderInfo()
    fireEvent.click(screen.getByRole('button', { name: /sign up as a team/i }))
    fireEvent.change(screen.getByLabelText('Search players'), { target: { value: 'nico' } })

    const names = screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent ?? '')
    expect(names.some((n) => n.startsWith('Nico Lee'))).toBe(true)
    expect(names.some((n) => n.startsWith('Nico Stone'))).toBe(true)
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

  it('catches an email that already has an account on the form, before confirming', async () => {
    m.checkEmail.mockResolvedValue('email_in_use')
    renderInfo()
    openNewPartnerForm()
    fillNewPartner()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/already has an account/i)
    expect(m.checkEmail).toHaveBeenCalledWith({ email: 'gus@example.com' })
    expect(screen.queryByText('You + Gus')).toBeNull()
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
      true,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Search members' }))
    expect((screen.getByLabelText('Search players') as HTMLInputElement).value).toBe('Gus')
    expect(m.registerTeam).not.toHaveBeenCalled()
  })

  it('still shows email_in_use from registration if the email was taken meanwhile', async () => {
    m.registerTeam.mockResolvedValue({ status: 'email_in_use', teamId: null, partnerId: null })
    renderInfo()
    openNewPartnerForm()
    fillNewPartner()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('You + Gus')).not.toBeNull()
    expect(screen.getByText(/€20\.00 for the team/i)).not.toBeNull()
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
    fireEvent.click(await screen.findByRole('button', { name: 'Sign up' }))

    expect(
      await screen.findByText('Gus can sign in with gus@example.com to accept. Let them know!'),
    ).not.toBeNull()
  })

  it('says both are on the waitlist when the team lands there', async () => {
    m.registerTeam.mockResolvedValue({ status: 'waitlist', teamId: 'tm9', partnerId: 'p1' })
    renderInfo()
    fireEvent.click(screen.getByRole('button', { name: /sign up as a team/i }))
    fireEvent.click(screen.getByRole('button', { name: /bob/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    fireEvent.click(screen.getByRole('button', { name: /^(sign up|join the waitlist)$/i }))

    expect(await screen.findByText("You're both on the waitlist.")).not.toBeNull()
  })
})

describe('team lists and card', () => {
  it('renders teams as "A & B" and no transfer UI for a viewer without a team', () => {
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
    registrations = [
      reg('r1', 'me', 'tm1', 'registered'),
      reg('r2', 'p1', 'tm1', 'registered', null),
    ]
    m.teams = [team('tm1', 'me', '2026-10-01T10:00:00Z')]
    m.changeTeamPartner.mockResolvedValue({ status: 'change_closed', partnerId: null })
    renderInfo()

    fireEvent.click(screen.getByRole('button', { name: 'Change partner' }))
    fireEvent.click(screen.getByRole('button', { name: /eve/i }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Change partner' }).pop()!)

    expect((await screen.findByRole('alert')).textContent).toMatch(/close 12 hours/i)
  })
})

const mine = ({ partnerAccepted }: { partnerAccepted: boolean }) => {
  registrations = [
    reg('r1', 'me', 'tm1', 'registered'),
    reg('r2', 'p1', 'tm1', 'registered', partnerAccepted ? '2026-10-02T10:00:00Z' : null),
  ]
  m.teams = [team('tm1', 'me', '2026-10-01T10:00:00Z')]
}

const theirs = ({ partnerAccepted }: { partnerAccepted: boolean }) => {
  registrations = [
    reg('r1', 'p1', 'tm1', 'registered'),
    reg('r2', 'me', 'tm1', 'registered', partnerAccepted ? '2026-10-02T10:00:00Z' : null),
  ]
  m.teams = [team('tm1', 'p1', '2026-10-01T10:00:00Z')]
}

describe('pending and confirmed team card', () => {
  it('lets a captain with a pending partner change partner or cancel the team', async () => {
    mine({ partnerAccepted: false })
    m.cancelMyTeam.mockResolvedValue({ status: 'cancelled', promotedTeamId: null })
    renderInfo()

    expect(screen.getByText(/waiting for bob to accept/i)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Change partner' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel team' }))

    await waitFor(() =>
      expect(m.cancelMyTeam).toHaveBeenCalledWith({ tournamentId: 't1', teamId: 'tm1' }),
    )
  })

  it('does not cancel when the captain backs out of the confirm', () => {
    mine({ partnerAccepted: false })
    m.confirm.mockResolvedValue(false)
    renderInfo()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel team' }))

    expect(m.cancelMyTeam).not.toHaveBeenCalled()
  })

  it('shows a confirmed team as confirmed, with transfer and no cancel or change', () => {
    mine({ partnerAccepted: true })
    renderInfo()

    expect(screen.getByText(/confirmed ✓/i)).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Cancel team' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Change partner' })).toBeNull()
    expect(screen.getByRole('button', { name: /transfer spot/i })).not.toBeNull()
  })

  it('hides transfer while the partner is pending', () => {
    mine({ partnerAccepted: false })
    renderInfo()

    expect(screen.queryByRole('button', { name: /transfer spot/i })).toBeNull()
  })

  it('hides transfer for a confirmed team on the waitlist', () => {
    mine({ partnerAccepted: true })
    registrations = (registrations as Array<{ status: string }>).map((r) => ({
      ...r,
      status: 'waitlist',
    }))
    renderInfo()

    expect(screen.queryByRole('button', { name: /transfer spot/i })).toBeNull()
  })

  it('lets a pending partner accept', async () => {
    theirs({ partnerAccepted: false })
    m.respondToTeamInvite.mockResolvedValue('accepted')
    renderInfo()

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    await waitFor(() =>
      expect(m.respondToTeamInvite).toHaveBeenCalledWith({
        tournamentId: 't1',
        teamId: 'tm1',
        accept: true,
      }),
    )
  })

  it('asks before "I\'m not playing" and says the team is cancelled', async () => {
    theirs({ partnerAccepted: false })
    m.respondToTeamInvite.mockResolvedValue('declined')
    renderInfo()

    fireEvent.click(screen.getByRole('button', { name: "I'm not playing" }))

    await waitFor(() =>
      expect(m.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/team is cancelled.*keep spots for complete teams/i),
        }),
      ),
    )
    await waitFor(() =>
      expect(m.respondToTeamInvite).toHaveBeenCalledWith({
        tournamentId: 't1',
        teamId: 'tm1',
        accept: false,
      }),
    )
  })

  it('does not decline when the partner backs out of the confirm', async () => {
    theirs({ partnerAccepted: false })
    m.confirm.mockResolvedValue(false)
    renderInfo()

    fireEvent.click(screen.getByRole('button', { name: "I'm not playing" }))

    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(m.respondToTeamInvite).not.toHaveBeenCalled()
  })
})

describe('ended team notice', () => {
  const ended = (reason: string) => {
    m.teams = [team('tm1', 'me', '2026-10-01T10:00:00Z', reason)]
    registrations = [reg('r1', 'me', 'tm1', 'cancelled'), reg('r2', 'p1', 'tm1', 'cancelled', null)]
  }

  it('tells the captain their partner declined and reopens the join card', () => {
    ended('partner_declined')
    renderInfo()

    expect(screen.getByText(/bob declined, so your team was cancelled/i)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sign up again' }))

    expect(screen.getByText('Choose your partner')).not.toBeNull()
    expect(screen.queryByText(/bob declined/i)).toBeNull()
  })

  it('tells the team an admin cancelled it', () => {
    ended('admin_cancelled')
    renderInfo()

    expect(screen.getByText('An admin cancelled your team.')).not.toBeNull()
  })

  it('says nothing when the captain cancelled', () => {
    ended('captain_cancelled')
    renderInfo()

    expect(screen.queryByRole('button', { name: 'Sign up again' })).toBeNull()
  })

  it('says nothing to the partner who declined', () => {
    m.teams = [team('tm1', 'p1', '2026-10-01T10:00:00Z', 'partner_declined')]
    registrations = [reg('r1', 'p1', 'tm1', 'cancelled'), reg('r2', 'me', 'tm1', 'cancelled', null)]
    renderInfo()

    expect(screen.queryByRole('button', { name: 'Sign up again' })).toBeNull()
  })

  it('says nothing once the viewer has signed up again', () => {
    ended('partner_declined')
    registrations = [
      ...registrations,
      reg('r3', 'me', 'tm2', 'registered'),
      reg('r4', 'p4', 'tm2', 'registered', null),
    ]
    m.teams = [...m.teams, team('tm2', 'me', '2026-10-05T10:00:00Z')]
    renderInfo()

    expect(screen.queryByRole('button', { name: 'Sign up again' })).toBeNull()
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

  it('badges pending and confirmed teams', () => {
    registrations = [
      reg('r1', 'p2', 'tm1', 'registered'),
      reg('r2', 'p3', 'tm1', 'registered', null),
      reg('r3', 'p4', 'tm2', 'waitlist'),
      reg('r4', 'p5', 'tm2', 'waitlist'),
    ]
    renderInfo({ isAdmin: true })

    expect(screen.getByText('Waiting for Dan to accept')).not.toBeNull()
    expect(screen.getByText('Confirmed')).not.toBeNull()
    expect(screen.getAllByRole('button', { name: 'Change partner' }).length).toBe(2)
  })

  it('labels the new-partner link from the admin point of view', () => {
    renderInfo({ isAdmin: true })

    fireEvent.click(screen.getByRole('button', { name: /add team/i }))
    fireEvent.click(screen.getByRole('button', { name: /alma/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(
      screen.getByRole('button', { name: /^their partner isn't on padel lobsters/i }),
    ).not.toBeNull()
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
    expect(m.confirm).toHaveBeenCalledWith({
      title: 'Add this team?',
      message: expect.stringMatching(/Captain: Alma\nPartner: Bob/),
      confirmLabel: 'Add team',
    })
  })

  it('confirms a new partner with their email', async () => {
    m.registerTeam.mockResolvedValue({ status: 'registered', teamId: 'tm9', partnerId: 'p9' })
    renderInfo({ isAdmin: true })

    fireEvent.click(screen.getByRole('button', { name: /add team/i }))
    fireEvent.click(screen.getByRole('button', { name: /alma/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: /^their partner isn't on padel lobsters/i }))
    fillNewPartner()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Add team' }))

    await waitFor(() =>
      expect(m.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Partner: Gus (gus@example.com, new to Padel Lobsters)'),
        }),
      ),
    )
  })

  it("doesn't add the team when the admin backs out of the confirmation", async () => {
    m.confirm.mockResolvedValue(false)
    renderInfo({ isAdmin: true })

    fireEvent.click(screen.getByRole('button', { name: /add team/i }))
    fireEvent.click(screen.getByRole('button', { name: /alma/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: /bob/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add team' }))

    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(m.registerTeam).not.toHaveBeenCalled()
  })
})

describe('roster line', () => {
  it('counts teams on a team event', () => {
    m.teams = [team('tm1', 'p2', '2026-10-01T10:00:00Z'), team('tm2', 'p4', '2026-10-02T10:00:00Z')]
    registrations = [
      reg('r1', 'p2', 'tm1', 'registered'),
      reg('r2', 'p3', 'tm1', 'registered'),
      reg('r3', 'p4', 'tm2', 'waitlist'),
      reg('r4', 'p5', 'tm2', 'waitlist'),
    ]
    renderInfo()

    expect(screen.getByText(/1 of 4 teams/)).not.toBeNull()
    expect(screen.getByText(/1 team waiting/)).not.toBeNull()
  })
})

describe('signup notices', () => {
  const signUpWithBob = (status: 'registered' | 'waitlist' = 'registered') => {
    m.registerTeam.mockResolvedValue({ status, teamId: 'tm9', partnerId: 'p1' })
    const view = renderInfo()
    fireEvent.click(screen.getByRole('button', { name: /sign up as a team/i }))
    fireEvent.click(screen.getByRole('button', { name: /bob/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText(/we keep spots for complete teams/i)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^(sign up|join the waitlist)$/i }))
    return view
  }

  it('asks a member partner to accept in the app', async () => {
    signUpWithBob()

    expect(
      await screen.findByText("We've asked Bob to accept in the app. Let them know!"),
    ).not.toBeNull()
  })

  it('can be dismissed', async () => {
    signUpWithBob()
    await screen.findByText(/we've asked bob/i)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByText(/we've asked bob/i)).toBeNull()
  })

  it('clears when the team is promoted off the waitlist', async () => {
    const view = signUpWithBob('waitlist')
    await screen.findByText("You're both on the waitlist.")

    const rows = (status: string) => [
      reg('r1', 'me', 'tm9', status),
      reg('r2', 'p1', 'tm9', status, null),
    ]
    m.teams = [team('tm9', 'me', '2026-10-01T10:00:00Z')]
    registrations = rows('waitlist')
    view.rerender()
    expect(screen.getAllByText(/both on the waitlist/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Dismiss' })).not.toBeNull()

    registrations = rows('registered')
    view.rerender()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
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
