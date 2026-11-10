// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

const mockConfirm = vi.fn()
const mockForceAccept = vi.fn()
const mockAdminCancel = vi.fn()

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
    adminCancelTransfer: mockAdminCancel,
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

  it('restates both players and the event before a force-accept', async () => {
    mockForceAccept.mockResolvedValue({ ok: true, status: 'accepted' })
    renderPanel()

    fireEvent.click(
      within(screen.getAllByRole('listitem')[0]).getByRole('button', { name: 'Force accept' }),
    )

    await waitFor(() => expect(mockForceAccept).toHaveBeenCalledWith('x1'))
    const { message, confirmLabel } = mockConfirm.mock.calls[0]![0]
    expect(confirmLabel).toBe('Force accept')
    expect(message).toContain('From: Alma Reyes')
    expect(message).toContain('To: Bob Stone')
    expect(message).toContain('Event: Social')
  })

  it('restates who before cancelling, and does nothing if declined', async () => {
    mockConfirm.mockResolvedValue(false)
    renderPanel()

    fireEvent.click(
      within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: 'Cancel offer' }),
    )

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    const options = mockConfirm.mock.calls[0]![0]
    expect(options.destructive).toBe(true)
    expect(options.message).toContain('From: Cleo Park')
    expect(options.message).toContain('The spot stays with Cleo Park.')
    expect(mockAdminCancel).not.toHaveBeenCalled()
  })

  it('keeps a row busy until its own request finishes', async () => {
    const settle: Record<string, (r: { ok: boolean; status: string }) => void> = {}
    mockForceAccept.mockImplementation(
      (id: string) => new Promise((resolve) => (settle[id] = resolve)),
    )
    renderPanel()
    const [rowA, rowB] = screen.getAllByRole('listitem')
    const force = (row: HTMLElement) =>
      within(row).getByRole('button', { name: /Force accept|Working/ })

    fireEvent.click(force(rowA!))
    await waitFor(() => expect(force(rowA!).hasAttribute('disabled')).toBe(true))
    expect(force(rowB!).hasAttribute('disabled')).toBe(false)

    fireEvent.click(force(rowB!))
    await waitFor(() => expect(force(rowB!).hasAttribute('disabled')).toBe(true))

    await act(async () => settle.x2!({ ok: true, status: 'accepted' }))
    expect(force(rowB!).hasAttribute('disabled')).toBe(false)
    expect(force(rowA!).hasAttribute('disabled')).toBe(true)

    await act(async () => settle.x1!({ ok: true, status: 'accepted' }))
    expect(force(rowA!).hasAttribute('disabled')).toBe(false)
  })
})
