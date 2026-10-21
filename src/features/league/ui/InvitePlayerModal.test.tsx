// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const { invite } = vi.hoisted(() => ({
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
  it('sends the trimmed email for this player', () => {
    renderModal()
    typeEmail('  ada@example.com ')
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }))

    expect(invite.current.mutateAsync).toHaveBeenCalledWith({
      input_player_id: 'ph1',
      input_email: 'ada@example.com',
    })
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
