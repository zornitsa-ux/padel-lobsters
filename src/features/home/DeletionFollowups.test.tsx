// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { renderWithClient } from '../../test/renderWithClient'
import { describeFollowup, type DeletionFollowup } from './deletionFollowupQueries'

const h = vi.hoisted(() => ({
  fetch: vi.fn(),
  dismiss: vi.fn(),
}))

vi.mock('./deletionFollowupQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./deletionFollowupQueries')>()),
  fetchDeletionFollowups: () => h.fetch(),
  dismissDeletionFollowup: (args: { id: number }) => h.dismiss(args),
}))

import DeletionFollowups from './DeletionFollowups'

const row = (over: Partial<DeletionFollowup>): DeletionFollowup => ({
  kind: 'free_text',
  ref_table: 'players',
  ref_id: 'p2',
  ref_column: 'notes',
  player_name: 'Anonymous Crab #7',
  followup_id: null,
  context_id: 'p2',
  ...over,
})

const LEAGUE = row({
  kind: 'league_team',
  ref_table: 'league_teams',
  ref_id: 'lt1',
  ref_column: null,
  context_id: 'l1',
})
const NOTES = row({ followup_id: 42 })

const renderCard = () =>
  renderWithClient(
    <MemoryRouter>
      <DeletionFollowups />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  h.dismiss.mockResolvedValue('dismissed')
})
afterEach(cleanup)

describe('describeFollowup', () => {
  it('links a league team to its league manage page', () => {
    expect(describeFollowup(LEAGUE)).toEqual({
      text: 'Anonymous Crab #7 is on a league team. Pick a replacement.',
      to: '/league/l1/manage',
    })
  })

  it('links a team in an upcoming event to the event', () => {
    const team = row({ kind: 'event_team', ref_table: 'event_teams', context_id: 't1' })
    expect(describeFollowup(team).to).toBe('/events/t1/info')
  })

  it('names the field that may still hold the old name, and where to edit it', () => {
    expect(describeFollowup(row({ ref_table: 'tournaments', context_id: 't1' }))).toEqual({
      text: 'An event description may still mention the member who is now Anonymous Crab #7.',
      to: '/events/t1/info',
    })
    expect(
      describeFollowup(row({ ref_table: 'merch_interests', ref_column: 'admin_comment' })).to,
    ).toBe('/community/shop?tab=orders')
    expect(describeFollowup(NOTES).to).toBe('/community/p2')
  })
})

describe('DeletionFollowups', () => {
  it('shows nothing when there is nothing to follow up', async () => {
    h.fetch.mockResolvedValue([])
    const { container } = renderCard()
    await waitFor(() => expect(h.fetch).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('lists each follow-up with a link, and Dismiss only for text', async () => {
    h.fetch.mockResolvedValue([LEAGUE, NOTES])
    renderCard()
    expect(await screen.findByText('After account deletions')).toBeTruthy()
    const links = screen.getAllByRole('link', { name: 'Open' })
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/league/l1/manage', '/community/p2'])
    expect(screen.getAllByRole('button', { name: 'Dismiss' })).toHaveLength(1)
  })

  it('dismisses a text follow-up and reloads the list', async () => {
    h.fetch.mockResolvedValueOnce([NOTES]).mockResolvedValue([])
    renderCard()
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(h.dismiss).toHaveBeenCalledWith({ id: 42 }))
    await waitFor(() => expect(screen.queryByText('After account deletions')).toBeNull())
  })

  it('says so when the list fails to load', async () => {
    h.fetch.mockRejectedValue(new Error('boom'))
    renderCard()
    expect(
      await screen.findByText("Couldn't load the follow-ups after account deletions."),
    ).toBeTruthy()
  })
})
