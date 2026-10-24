// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { renderHookWithClient, makeTestQueryClient } from '../../../test/renderWithClient'
import { playerKeys } from '../../players/playerKeys'
import { registrationKeys } from '../registrationKeys'
import type { PartnerChoice } from './teamTypes'
import { useTeamActions } from './useTeams'

vi.mock('./teamQueries', () => ({ registerTeam: vi.fn() }))
vi.mock('../../../lib/toastBus', () => ({ useToast: () => ({ showToast: vi.fn() }) }))

import * as q from './teamQueries'

const register = async (choice: PartnerChoice) => {
  const client = makeTestQueryClient()
  vi.spyOn(client, 'invalidateQueries')
  const { result } = renderHookWithClient(() => useTeamActions(), client)
  await act(async () => {
    await result.current.registerTeam({ tournamentId: 't1', captainId: 'p1', choice })
  })
  return client.invalidateQueries
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(q.registerTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
    status: 'registered',
    teamId: 'tm1',
    partnerId: 'p2',
  })
})

describe('useTeamActions invalidation', () => {
  it('leaves the player list alone when the partner is already a member', async () => {
    const invalidate = await register({ kind: 'member', playerId: 'p2' })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: registrationKeys.list('t1') })
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })

  it('refreshes the player list when a new partner account was created', async () => {
    const invalidate = await register({
      kind: 'new',
      partner: { name: 'New One', email: 'new@example.test', playtomicLevel: null },
      consent: true,
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: playerKeys.all() })
  })
})
