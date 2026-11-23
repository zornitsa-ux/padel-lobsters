// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithClient } from '../../test/renderWithClient'

// D-028: every roster/registration badge reads playtomicLevel.

import PlayersList from './PlayersList'
import PendingApprovalsList from './PendingApprovalsList'
import RegisteredSection from '../events/registration/RegisteredSection'
import { normalisePlayers } from '../../lib/normalise'
import { mkRegistration } from '../../test/factories'

// Built through the real normaliser so the fixture is a complete Player rather
// than a hand-written subset.
const [player] = normalisePlayers([
  {
    id: 'p1',
    name: 'Ada Lovelace',
    playtomic_level: 3.5,
    status: 'active',
  },
])

afterEach(cleanup)

describe('roster level badges read the Playtomic level', () => {
  it('PlayersList shows the Playtomic level', () => {
    render(
      <MemoryRouter>
        <PlayersList
          orderedForRender={[{ p: player, idx: 0, isSelf: false }]}
          displayName={(p) => p.name || ''}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('3.5')).toBeTruthy()
  })

  it('PendingApprovalsList shows the Playtomic level', () => {
    // Needs a QueryClientProvider — each pending row's email reveal control
    // is backed by usePlayerPii/useForgetPlayerPii now (not fetched until
    // tapped, but the hooks still need a client in the tree).
    renderWithClient(
      <PendingApprovalsList
        pendingPlayers={[player]}
        onApprove={() => {}}
        onReject={() => {}}
        onLink={() => {}}
      />,
    )

    expect(screen.getByText(/Lv 3\.5/)).toBeTruthy()
  })

  it('RegisteredSection shows the Playtomic level', () => {
    render(
      <RegisteredSection
        isCompleted={false}
        getPlayer={() => player}
        registered={[mkRegistration({ id: 'r1', playerId: 'p1', paymentStatus: 'unpaid' })]}
        maxPlayers={16}
        isAdmin
        displayName={(p: { name: string }) => p.name}
        onCancelRegistration={() => {}}
        pendingByFromPlayerId={new Map()}
        respondingTo={null}
        onOpenShareModal={() => {}}
        onAdminCancelTransfer={() => {}}
        onStartTransfer={() => {}}
      />,
    )

    expect(screen.getByText(/Level 3\.5/)).toBeTruthy()
  })
})
