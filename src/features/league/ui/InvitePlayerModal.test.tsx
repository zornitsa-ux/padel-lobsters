// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const { invite, confirmInviteEmail } = vi.hoisted(() => ({
  confirmInviteEmail: vi.fn(),
  invite: {
    current: {} as {
      mutateAsync: ReturnType<typeof vi.fn>
      reset: ReturnType<typeof vi.fn>
      isPending: boolean
      isSuccess: boolean
      data?: string | null
      error: Error | null
    },
  },
}))

vi.mock('../hooks/useLeagueMutations', () => ({ useInviteLeaguePlayer: () => invite.current }))
vi.mock('../../players/useConfirmInviteEmail', () => ({
  useConfirmInviteEmail: () => confirmInviteEmail,
}))

import { InvitePlayerModal } from './InvitePlayerModal'

const renderModal = () =>
  render(
    <InvitePlayerModal
      open
      onClose={() => {}}
      playerId="ph1"
      playerName="Ada Lovelace"
      leagueId="l1"
    />,
  )

const typeEmail = (email: string) =>
  fireEvent.change(screen.getByPlaceholderText('player@example.com'), { target: { value: email } })

beforeEach(() => {
  confirmInviteEmail.mockReset().mockResolvedValue(true)
  invite.current = {
    mutateAsync: vi.fn().mockResolvedValue(null),
    reset: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null,
  }
})
afterEach(cleanup)

describe('InvitePlayerModal', () => {
  it('names the player and address, then sends the trimmed email', async () => {
    renderModal()
    typeEmail('  Ada@example.com ')
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    expect(confirmInviteEmail).toHaveBeenCalledWith({
      kind: 'league_invite',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
    await waitFor(() =>
      expect(invite.current.mutateAsync).toHaveBeenCalledWith({
        input_player_id: 'ph1',
        input_email: 'Ada@example.com',
      }),
    )
  })

  it('sends nothing when the admin cancels the confirm', async () => {
    confirmInviteEmail.mockResolvedValue(false)
    renderModal()
    typeEmail('ada@example.com')
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() => expect(confirmInviteEmail).toHaveBeenCalled())
    expect(invite.current.mutateAsync).not.toHaveBeenCalled()
  })

  it('confirms the sent invite, shows no PIN, and waits for Done', () => {
    invite.current = { ...invite.current, isSuccess: true, data: null }
    renderModal()
    typeEmail('Ada@Example.com')

    expect(screen.queryByText(/pin/i)).toBeNull()
    expect(screen.getByText(/invite sent to ada@example\.com/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /done/i })).toBeTruthy()
  })

  it.each([
    ['invalid email', /valid email address/i],
    ['email in use', /already belongs to another/i],
    ['player is not a placeholder', /already been invited/i],
  ])('explains a %s refusal', (raised, shown) => {
    invite.current = { ...invite.current, error: new Error(raised) }
    renderModal()

    expect(screen.getByText(shown)).toBeTruthy()
  })
})
