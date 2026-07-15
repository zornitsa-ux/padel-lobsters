// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import MatchmakingContainer from './MatchmakingContainer'

// The commit path is the only impure call here; the pure domain runs for real
// so the busy/arrival wiring is exercised against actual generation.
vi.mock('./useMatchmaking', () => ({
  useCommitSchedule: () => ({ mutate: vi.fn(), isPending: false }),
}))

const roster = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    playerId: `p${i}`,
    name: `Player ${i}`,
    playtomicLevel: 3 + (i % 4) * 0.25,
    mmRating: null,
    mmSigma: null,
    isLeftHanded: false,
    gender: i % 2 === 0 ? 'male' : 'female',
  }))

const renderContainer = () =>
  renderWithClient(
    <MatchmakingContainer
      tournamentId="t-1"
      roster={roster(8)}
      courts={2}
      rounds={4}
      genderMode="mixed"
      scoresEntered={false}
    />,
  )

const button = (name: RegExp) =>
  screen.queryByRole('button', { name }) as HTMLButtonElement | null

describe('MatchmakingContainer — generate feedback (M3.6 Finding 4)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  // vite.config.js does not set `globals: true`, so testing-library's automatic
  // per-test cleanup never registers — without this, renders stack up and
  // getByRole finds duplicates.
  afterEach(cleanup)

  it('renders no preview until generate is clicked', () => {
    renderContainer()
    expect(button(/reshuffle/i)).toBeNull()
  })

  it('shows the schedule and scrolls it into view after generating', async () => {
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: /generate schedule/i }))

    await waitFor(() => expect(button(/reshuffle/i)).not.toBeNull())
    // The arrival must be brought on screen — the whole point of Finding 4.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('announces arrival to assistive tech', async () => {
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: /generate schedule/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/schedule generated/i)
    })
  })

  it('reshuffle replaces the run and re-announces', async () => {
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    await waitFor(() => expect(button(/reshuffle/i)).not.toBeNull())
    vi.mocked(Element.prototype.scrollIntoView).mockClear()

    fireEvent.click(screen.getByRole('button', { name: /reshuffle/i }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/new schedule generated/i)
    })
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
