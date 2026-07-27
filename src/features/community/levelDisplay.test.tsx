// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// D-028: every roster/registration badge now reads playtomicLevel. A player
// carrying a stale adjusted_level from before D-018 must not have it shown —
// these renders pass a row where the two values differ, so a regression that
// reads the legacy field shows 4.5 instead of 3.5.
vi.mock('./reviewScenarios', () => ({
  corpReview: () => ({ hasLabel: false, scenarioLabel: '', body: 'A review.' }),
}))
vi.mock('./PlayerProfileDrawer', () => ({ default: () => null }))

import PlayersList from './PlayersList'
import PendingApprovalsList from './PendingApprovalsList'
import RegisteredSection from '../events/registration/RegisteredSection'
import { LEVEL_COLORS } from './playerConstants'
import { normalisePlayers } from '../../lib/normalise'

// Built through the real normaliser so the fixture is a complete Player rather
// than a hand-written subset.
const [stalePlayer] = normalisePlayers([
  {
    id: 'p1',
    name: 'Ada Lovelace',
    playtomic_level: 3.5,
    // Legacy columns still present on the row but no longer read.
    adjustment: 1,
    adjustedLevel: 4.5,
    status: 'active',
  },
])

const levelBadge = (level: number) => LEVEL_COLORS[Math.min(7, Math.max(0, Math.floor(level || 0)))]

afterEach(cleanup)

describe('roster level badges read the Playtomic level', () => {
  it('PlayersList shows the Playtomic level, not adjusted_level', () => {
    render(
      <PlayersList
        orderedForRender={[{ p: stalePlayer, idx: 0, isSelf: false }]}
        hasPlayers
        focusPlayerId={null}
        focusRef={null}
        expandedId={null}
        setExpandedId={() => {}}
        isAdmin={false}
        levelBadge={levelBadge}
        displayName={(p) => p.name || ''}
        matches={[]}
        registrations={[]}
        tournaments={[]}
        playerAliases={{}}
        players={[stalePlayer]}
        onNavigate={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onRegeneratePin={() => {}}
      />,
    )

    expect(screen.getByText('3.5')).toBeTruthy()
    expect(screen.queryByText('4.5')).toBeNull()
  })

  it('PendingApprovalsList shows the Playtomic level', () => {
    render(
      <PendingApprovalsList
        pendingPlayers={[stalePlayer]}
        onApprove={() => {}}
        onReject={() => {}}
        onLink={() => {}}
      />,
    )

    expect(screen.getByText(/Lv 3\.5/)).toBeTruthy()
    expect(screen.queryByText(/Lv 4\.5/)).toBeNull()
  })

  it('RegisteredSection shows the Playtomic level', () => {
    render(
      <RegisteredSection
        isCompleted={false}
        getPlayer={() => stalePlayer}
        registered={[{ id: 'r1', playerId: 'p1', paymentStatus: 'unpaid' }]}
        maxPlayers={16}
        isAdmin
        displayName={(p: { name: string }) => p.name}
        onCancelRegistration={() => {}}
        pendingByFromPlayerId={new Map()}
        respondingTo={null}
        onOpenShareModal={() => {}}
        onCancelMyOffer={() => {}}
        onStartTransfer={() => {}}
      />,
    )

    expect(screen.getByText(/Level 3\.5/)).toBeTruthy()
    expect(screen.queryByText(/Level 4\.5/)).toBeNull()
  })
})
