// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const useApp = vi.fn()
const useEventPhase = vi.fn()

vi.mock('../../context/useApp', () => ({ useApp: () => useApp() }))
vi.mock('./useEventPhase', () => ({ useEventPhase: () => useEventPhase() }))

const EventShell = (await import('./EventShell')).default

import type { EventPhase } from './eventPhase'
import type { OscarsPhase } from '../oscars/oscarsPhase'
import type { NormalisedTournament } from '../../lib/normalise'

const TOURNAMENT = { id: 'evt-1', name: 'Friday Padel' } as NormalisedTournament

const ALL_LABELS = ['Info', 'You', 'Schedule', 'Results', 'Oscars', 'Manage']

function renderShell({
  phase,
  isAdmin,
  oscarsPhase = 'not_created',
  rafflePublishedAt = null,
}: {
  phase: EventPhase
  isAdmin: boolean
  oscarsPhase?: OscarsPhase
  rafflePublishedAt?: string | null
}) {
  useApp.mockReturnValue({
    session: { user: { app_metadata: { role: isAdmin ? 'admin' : 'player' }, id: 'u1' } },
  })
  useEventPhase.mockReturnValue({ phase, oscarsPhase })
  render(
    <MemoryRouter initialEntries={[`/events/evt-1/info`]}>
      <EventShell tournament={{ ...TOURNAMENT, rafflePublishedAt } as NormalisedTournament} />
    </MemoryRouter>,
  )
}

// Tab labels as rendered links, in DOM order.
const shownTabs = () =>
  screen
    .getAllByRole('link')
    .map((el) => el.textContent?.trim() ?? '')
    .filter((label) => ALL_LABELS.includes(label))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('EventShell tab strip — phase × role matrix', () => {
  const playerMatrix: Array<[EventPhase, string[]]> = [
    ['open', ['Info', 'You']],
    ['set', ['Info', 'You', 'Schedule']],
    ['live', ['Info', 'You', 'Schedule']],
    ['sealed', ['Info', 'You', 'Schedule']],
    ['social', ['Info', 'You', 'Schedule']],
    ['revealed', ['Info', 'You', 'Schedule', 'Results']],
  ]

  it.each(playerMatrix)('player at %s sees %j', (phase, expected) => {
    renderShell({ phase, isAdmin: false })
    expect(shownTabs()).toEqual(expected)
  })

  // Oscars is there throughout for an admin: with no session yet the tab is the
  // setup screen, and it is the only way to create one.
  const adminMatrix: Array<[EventPhase, string[]]> = [
    ['open', ['Info', 'You', 'Schedule', 'Oscars', 'Manage']],
    ['set', ['Info', 'You', 'Schedule', 'Oscars', 'Manage']],
    ['live', ['Info', 'You', 'Schedule', 'Oscars', 'Manage']],
    ['sealed', ['Info', 'You', 'Schedule', 'Oscars', 'Manage']],
    ['social', ['Info', 'You', 'Schedule', 'Oscars', 'Manage']],
    ['revealed', ['Info', 'You', 'Schedule', 'Results', 'Oscars', 'Manage']],
  ]

  it.each(adminMatrix)('admin at %s sees %j', (phase, expected) => {
    renderShell({ phase, isAdmin: true })
    expect(shownTabs()).toEqual(expected)
  })

  it('DEFECT GUARD — no Results tab exists before any score does', () => {
    // Six tabs used to exist from the moment an event was created, Results
    // among them, because the strip split on `isAdmin` and nothing else.
    for (const phase of ['open', 'set', 'live'] as EventPhase[]) {
      renderShell({ phase, isAdmin: true })
      expect(shownTabs()).not.toContain('Results')
      cleanup()
    }
  })

  it('DEFECT GUARD — a published raffle opens Results even with standings embargoed', () => {
    // The winners were stranded: publishing put them on the Results tab, which
    // was gated on the standings reveal, so nobody could open it.
    renderShell({ phase: 'social', isAdmin: false, rafflePublishedAt: '2026-08-01T20:00:00Z' })
    expect(shownTabs()).toContain('Results')
  })

  it('shared Oscars winners open Results on their own too', () => {
    renderShell({ phase: 'social', isAdmin: false, oscarsPhase: 'shared' })
    expect(shownTabs()).toContain('Results')
  })

  it('DEFECT GUARD — a player keeps an Oscars tab after the tournament completes', () => {
    // The lockout: Oscars lived in ADMIN_TAB_PATHS and a player's only door was
    // an Info-tab button wrapped in `{!isCompleted && …}`, which Finish closed.
    // `social` is exactly the completed-but-not-revealed phase.
    renderShell({ phase: 'social', isAdmin: false, oscarsPhase: 'active' })
    expect(shownTabs()).toContain('Oscars')
  })

  it('shows no Oscars tab when no session has been created', () => {
    renderShell({ phase: 'social', isAdmin: false, oscarsPhase: 'not_created' })
    expect(shownTabs()).not.toContain('Oscars')
  })

  it('hides a pre-start Oscars session from players but shows it to admins', () => {
    renderShell({ phase: 'social', isAdmin: false, oscarsPhase: 'pre_start' })
    expect(shownTabs()).not.toContain('Oscars')
    cleanup()

    renderShell({ phase: 'social', isAdmin: true, oscarsPhase: 'pre_start' })
    expect(shownTabs()).toContain('Oscars')
  })

  it('never shows Manage to a player', () => {
    for (const phase of ['open', 'set', 'live', 'sealed', 'social', 'revealed'] as EventPhase[]) {
      renderShell({ phase, isAdmin: false, oscarsPhase: 'shared' })
      expect(shownTabs()).not.toContain('Manage')
      cleanup()
    }
  })

  it('points each tab at its own route', () => {
    renderShell({ phase: 'revealed', isAdmin: true, oscarsPhase: 'shared' })
    const hrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href'))
      .filter((href) => href?.startsWith('/events/evt-1/'))
    expect(hrefs).toEqual([
      '/events/evt-1/info',
      '/events/evt-1/me',
      '/events/evt-1/schedule',
      '/events/evt-1/results',
      '/events/evt-1/oscars',
      '/events/evt-1/manage',
    ])
  })
})
