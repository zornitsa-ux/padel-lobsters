// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

const m = vi.hoisted(() => ({
  updatePlayer: vi.fn(),
  acknowledge: vi.fn(),
  country: '',
  setup: { requestedByName: 'Cara Diaz', tournamentName: 'King Sunday', acknowledged: false } as {
    requestedByName: string
    tournamentName: string
    acknowledged: boolean
  } | null,
}))

vi.mock('../../../context/useApp', () => ({
  useApp: () => ({ session: { user: { id: 'me', email: 'new@example.test' } }, role: 'player' }),
}))
vi.mock('../../players/usePlayers', () => ({
  useMyProfile: () => ({
    isLoading: false,
    data: {
      name: 'Gus Grant',
      country: m.country,
      gender: '',
      isLeftHanded: false,
      preferredPosition: '',
      playtomicLevel: 3.5,
      phone: null,
      birthday: null,
    },
  }),
  usePlayerActions: () => ({ updatePlayer: m.updatePlayer }),
}))
vi.mock('../teams/useTeams', () => ({
  useMyAccountSetup: () => ({ data: m.setup, isPending: false }),
  useAcknowledgeMyAccount: () => m.acknowledge,
}))

const FinishAccountPage = (await import('./FinishAccountPage')).default

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/finish-account']}>
      <Routes>
        <Route path="/finish-account" element={<FinishAccountPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  m.setup = { requestedByName: 'Cara Diaz', tournamentName: 'King Sunday', acknowledged: false }
  m.updatePlayer.mockResolvedValue(undefined)
  m.acknowledge.mockResolvedValue('ok')
  m.country = ''
})
afterEach(cleanup)

const fillRequired = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Male' }))
  fireEvent.change(screen.getByPlaceholderText('+31612345678'), {
    target: { value: '+31600000000' },
  })
}

describe('finish your account', () => {
  it('says who created the account, prefilled from what the captain entered', () => {
    renderPage()

    expect(
      screen.getByText(/cara diaz created a padel lobsters account for you with new@example.test/i),
    ).not.toBeNull()
    expect((screen.getByPlaceholderText('e.g. Augustin') as HTMLInputElement).value).toBe('Gus')
    expect((screen.getByPlaceholderText('e.g. Tapia') as HTMLInputElement).value).toBe('Grant')
    expect((screen.getByPlaceholderText('e.g. 3.5') as HTMLInputElement).value).toBe('3.5')
  })

  it('needs the acknowledgement before it can be submitted', () => {
    renderPage()
    const submit = screen.getByRole('button', { name: /finish and see your invite/i })

    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect((submit as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows what is missing instead of saving an incomplete profile', () => {
    renderPage()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /finish and see your invite/i }))

    expect(screen.getByRole('alert').textContent).toMatch(/please complete/i)
    expect(m.updatePlayer).not.toHaveBeenCalled()
  })

  it('saves the profile, records the acknowledgement and goes to the invite', async () => {
    m.country = 'NL'
    renderPage()
    fillRequired()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /finish and see your invite/i }))

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/team-invites'))
    expect(m.updatePlayer).toHaveBeenCalledWith(
      'me',
      expect.objectContaining({ name: 'Gus Grant', gender: 'male', phone: '+31600000000' }),
    )
    expect(m.acknowledge).toHaveBeenCalled()
  })

  it('leaves for the invites when there is nothing to finish', async () => {
    m.setup = null
    renderPage()

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/team-invites'))
  })
})
