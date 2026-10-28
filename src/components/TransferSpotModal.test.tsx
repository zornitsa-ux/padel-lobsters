// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import type { NormalisedTournament } from '../lib/normalise'

const mockConfirm = vi.fn()
const mockCreateTransfer = vi.fn()
const mockAdminTransfer = vi.fn()

vi.mock('../context/useApp', () => ({
  useApp: () => ({ session: { user: { id: 'admin' } }, isAdmin: true }),
}))
vi.mock('../lib/confirmBus', () => ({ useConfirm: () => mockConfirm }))
vi.mock('../features/players/usePlayers', () => ({
  usePlayers: () => ({
    data: [
      { id: 'p1', name: 'Alma Reyes', status: 'active' },
      { id: 'p2', name: 'Bob Stone', status: 'active' },
    ],
  }),
}))
vi.mock('../features/events/useRegistrations', () => ({
  useRegistrations: () => ({ data: [] }),
}))
vi.mock('../features/events/useTransfers', () => ({
  useTransferActions: () => ({
    createTransfer: mockCreateTransfer,
    adminTransferRegistration: mockAdminTransfer,
  }),
}))

const TransferSpotModal = (await import('./TransferSpotModal')).default

const tournament = { id: 't1' } as unknown as NormalisedTournament

const renderOnBehalf = () =>
  render(<TransferSpotModal tournament={tournament} fromPlayerId="p1" onClose={vi.fn()} />)

beforeEach(() => {
  vi.clearAllMocks()
  mockConfirm.mockResolvedValue(true)
  mockCreateTransfer.mockResolvedValue({ ok: true, transferId: 'x1' })
})
afterEach(cleanup)

describe('TransferSpotModal, admin on behalf', () => {
  it('confirms who the spot moves from and to before creating the transfer', async () => {
    renderOnBehalf()

    fireEvent.click(screen.getByRole('button', { name: /bob stone/i }))

    await waitFor(() => expect(mockCreateTransfer).toHaveBeenCalledWith('p2', 't1', 'p1'))
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Transfer this spot?',
        message: expect.stringMatching(/From: Alma Reyes\nTo: Bob Stone\nThey will be asked/),
      }),
    )
  })

  it('says so when the transfer is immediate', async () => {
    mockAdminTransfer.mockResolvedValue({ ok: true })
    renderOnBehalf()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /bob stone/i }))

    await waitFor(() => expect(mockAdminTransfer).toHaveBeenCalledWith('p1', 'p2', 't1'))
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Moves immediately') }),
    )
  })

  it("doesn't transfer when the admin backs out", async () => {
    mockConfirm.mockResolvedValue(false)
    renderOnBehalf()

    fireEvent.click(screen.getByRole('button', { name: /bob stone/i }))

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(mockCreateTransfer).not.toHaveBeenCalled()
  })
})
