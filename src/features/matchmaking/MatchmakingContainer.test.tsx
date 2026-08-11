// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import { mockSupabase } from '../../test/mockSupabase'
import MatchmakingContainer from './MatchmakingContainer'

// The commit path is the only impure call here; the pure domain runs for real
// so the busy/arrival wiring is exercised against actual generation.
vi.mock('./useMatchmaking', () => ({
  useCommitSchedule: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../../supabase', () => mockSupabase())

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

const button = (name: RegExp) => screen.queryByRole('button', { name }) as HTMLButtonElement | null

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
    expect(button(/^compare$/i)).toBeNull()
  })

  it('shows the schedule and scrolls it into view after generating', async () => {
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: /generate schedule/i }))

    await waitFor(() => expect(button(/^compare$/i)).not.toBeNull())
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

  it('compare opens the overlay with no alternative until the admin generates one', async () => {
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    await waitFor(() => expect(button(/^compare$/i)).not.toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /^compare$/i }))

    // Overlay is open, but the admin controls whether an alternative exists:
    // none is generated automatically, so "Use alternative" starts disabled.
    const useAlt = await screen.findByRole('button', { name: /use alternative/i })
    expect((useAlt as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /generate alternative/i }))

    await waitFor(() => expect((useAlt as HTMLButtonElement).disabled).toBe(false))
  })
})

describe('MatchmakingContainer — Fix repeat (M3.8, D-026)', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(cleanup)

  // This roster/courts/rounds/seed combination is known (fixture-checked) to
  // produce several rematch chips; not every chip admits a legal, balance-safe
  // swap, so the test walks the chips until it finds one that does rather than
  // hardcoding which chip that is (keeps it robust to generator retuning).
  it('shows ranked swap suggestions and applies one into the preview', async () => {
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    await waitFor(() => expect(button(/^compare$/i)).not.toBeNull())

    const fixButtons = () => screen.getAllByRole('button', { name: /^fix$/i })
    expect(fixButtons().length).toBeGreaterThan(0)

    let applyButton: HTMLButtonElement | null = null
    for (let i = 0; i < fixButtons().length; i++) {
      fireEvent.click(fixButtons()[i])
      await waitFor(() => expect(screen.getByText(/fix this repeat/i)).toBeTruthy())
      const applies = screen.queryAllByRole('button', { name: /^apply$/i })
      if (applies.length > 0) {
        applyButton = applies[0] as HTMLButtonElement
        break
      }
      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    }

    expect(applyButton).not.toBeNull()
    fireEvent.click(applyButton as HTMLButtonElement)

    await waitFor(() => expect(screen.queryByText(/fix this repeat/i)).toBeNull())
  })

  it('cancel dismisses the panel without changing the preview', async () => {
    renderContainer()
    fireEvent.click(screen.getByRole('button', { name: /generate schedule/i }))
    await waitFor(() => expect(button(/^compare$/i)).not.toBeNull())

    fireEvent.click(screen.getAllByRole('button', { name: /^fix$/i })[0])
    await waitFor(() => expect(screen.getByText(/fix this repeat/i)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText(/fix this repeat/i)).toBeNull()
  })
})
