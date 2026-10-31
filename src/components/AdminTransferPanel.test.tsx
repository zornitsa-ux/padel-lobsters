// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

const mockConfirm = vi.fn()
const mockForceAccept = vi.fn()

vi.mock('../context/useApp', () => ({
  useApp: () => ({ session: { user: { id: 'admin' } }, isAdmin: true }),
}))
vi.mock('../lib/confirmBus', () => ({ useConfirm: () => mockConfirm }))
vi.mock('../features/players/usePlayers', () => ({
  usePlayers: () => ({
    data: [
      { id: 'p1', name: 'Alma Reyes' },
      { id: 'p2', name: 'Bob Stone' },
      { id: 'p3', name: 'Cleo Park' },
    ],
  }),
}))
vi.mock('../features/events/useTransfers', () => ({
  useTransfers: () => ({
    data: [
      { id: 'x1', status: 'pending', tournamentId: 't1', fromPlayerId: 'p1', toPlayerId: 'p2' },
      { id: 'x2', status: 'pending', tournamentId: 't1', fromPlayerId: 'p3', toPlayerId: 'p1' },
      { id: 'x3', status: 'accepted', tournamentId: 't1', fromPlayerId: 'p2', toPlayerId: 'p3' },
    ],
  }),
  useTransferActions: () => ({
    forceAcceptTransfer: mockForceAccept,
    adminCancelTransfer: vi.fn(),
  }),
}))

const AdminTransferPanel = (await import('./AdminTransferPanel')).default

const renderPanel = () =>
  render(<AdminTransferPanel tournament={{ id: 't1', name: 'Social' }} onClose={vi.fn()} />)

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockResolvedValue(true)
})
afterEach(cleanup)

describe('AdminTransferPanel', () => {
  it('lists each pending transfer as a row', () => {
    renderPanel()

    const rows = within(screen.getByRole('list', { name: 'Pending transfers' })).getAllByRole(
      'listitem',
    )
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('Alma Reyes')).toBeTruthy()
    expect(within(rows[0]).getByText('Bob Stone')).toBeTruthy()
  })

  it('shows a failed force-accept in its own row', async () => {
    mockForceAccept.mockResolvedValue({ ok: false, status: 'not_pending' })
    renderPanel()

    const rows = screen.getAllByRole('listitem')
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Force accept' }))

    await waitFor(() =>
      expect(within(rows[1]).getByRole('alert').textContent).toBe(
        'Transfer was already responded to.',
      ),
    )
    expect(within(rows[0]).queryByRole('alert')).toBeNull()
  })
})
