// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ScoreEntry from './ScoreEntry'

afterEach(cleanup)

const match = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  score1: null as number | null,
  score2: null as number | null,
  completed: false,
  ...overrides,
})

const boxes = () => ({
  t1: screen.getByLabelText('Team 1 score') as HTMLInputElement | HTMLSelectElement,
  t2: screen.getByLabelText('Team 2 score') as HTMLInputElement | HTMLSelectElement,
})

const conflictButton = () => screen.queryByRole('button')

describe('ScoreEntry — peer updates vs. a local draft', () => {
  it('applies an incoming score when the admin is not mid-edit', () => {
    const { rerender } = render(<ScoreEntry match={match()} onUpdate={vi.fn()} />)

    rerender(
      <ScoreEntry match={match({ score1: 6, score2: 4, completed: true })} onUpdate={vi.fn()} />,
    )

    expect(boxes().t1.value).toBe('6')
    expect(boxes().t2.value).toBe('4')
    expect(conflictButton()).toBeNull()
  })

  // The reported bug: a peer's score arriving mid-entry wiped the boxes and the
  // admin had to start over.
  it('keeps a half-typed draft and parks the peer score instead of clobbering it', () => {
    const { rerender } = render(<ScoreEntry match={match()} onUpdate={vi.fn()} />)

    fireEvent.change(boxes().t1, { target: { value: '6' } })
    rerender(
      <ScoreEntry match={match({ score1: 3, score2: 5, completed: true })} onUpdate={vi.fn()} />,
    )

    expect(boxes().t1.value).toBe('6') // draft survives
    expect(boxes().t2.value).toBe('')
    expect(conflictButton()?.textContent).toContain('Another admin: 3–5')
  })

  it('adopts the parked peer score when the admin taps it', () => {
    const { rerender } = render(<ScoreEntry match={match()} onUpdate={vi.fn()} />)

    fireEvent.change(boxes().t1, { target: { value: '6' } })
    rerender(
      <ScoreEntry match={match({ score1: 3, score2: 5, completed: true })} onUpdate={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button'))

    expect(boxes().t1.value).toBe('3')
    expect(boxes().t2.value).toBe('5')
    expect(conflictButton()).toBeNull()
  })

  it("lets the admin's own entry win over a parked peer score", () => {
    const onUpdate = vi.fn()
    const { rerender } = render(<ScoreEntry match={match()} onUpdate={onUpdate} />)

    fireEvent.change(boxes().t1, { target: { value: '6' } })
    rerender(
      <ScoreEntry match={match({ score1: 3, score2: 5, completed: true })} onUpdate={onUpdate} />,
    )
    fireEvent.change(boxes().t2, { target: { value: '4' } })
    fireEvent.blur(boxes().t2)

    expect(onUpdate).toHaveBeenCalledWith('m1', { score1: 6, score2: 4, completed: true })
    expect(conflictButton()).toBeNull()
  })

  // Regression: the "score didn't change" early return in commit() used to skip
  // the dirty/conflict reset, leaving the pill up and the cell dirty forever.
  it('resolves a parked peer score even when the admin types that same score', () => {
    const onUpdate = vi.fn()
    const { rerender } = render(<ScoreEntry match={match()} onUpdate={onUpdate} />)

    fireEvent.change(boxes().t1, { target: { value: '6' } })
    rerender(
      <ScoreEntry match={match({ score1: 6, score2: 4, completed: true })} onUpdate={onUpdate} />,
    )
    expect(conflictButton()).not.toBeNull()

    fireEvent.change(boxes().t2, { target: { value: '4' } })
    fireEvent.blur(boxes().t2)

    // Nothing to write — the persisted score already matches.
    expect(onUpdate).not.toHaveBeenCalled()
    expect(conflictButton()).toBeNull()

    // …and the cell is no longer dirty, so the next peer update applies
    // straight away instead of parking as another conflict.
    rerender(
      <ScoreEntry match={match({ score1: 7, score2: 5, completed: true })} onUpdate={onUpdate} />,
    )
    expect(boxes().t1.value).toBe('7')
    expect(boxes().t2.value).toBe('5')
    expect(conflictButton()).toBeNull()
  })

  it('shows no conflict when the admins own write echoes back', () => {
    const onUpdate = vi.fn()
    const { rerender } = render(<ScoreEntry match={match()} onUpdate={onUpdate} />)

    fireEvent.change(boxes().t1, { target: { value: '6' } })
    fireEvent.change(boxes().t2, { target: { value: '4' } })
    fireEvent.blur(boxes().t2)
    // The optimistic cache patch flows back down as new props.
    rerender(
      <ScoreEntry match={match({ score1: 6, score2: 4, completed: true })} onUpdate={onUpdate} />,
    )

    expect(conflictButton()).toBeNull()
    expect(boxes().t1.value).toBe('6')
  })

  it('protects the select variant too', () => {
    const onUpdate = vi.fn()
    const { rerender } = render(<ScoreEntry match={match()} onUpdate={onUpdate} variant="select" />)

    fireEvent.change(boxes().t1, { target: { value: '6' } })
    rerender(
      <ScoreEntry
        match={match({ score1: 3, score2: 5, completed: true })}
        onUpdate={onUpdate}
        variant="select"
      />,
    )

    expect(boxes().t1.value).toBe('6')
    expect(conflictButton()?.textContent).toContain('Another admin: 3–5')
  })
})

describe('ScoreEntry — mobile keypad and auto-advance (input variant)', () => {
  it('raises a numeric keypad on both boxes', () => {
    render(<ScoreEntry match={match()} onUpdate={vi.fn()} />)
    expect(boxes().t1.getAttribute('inputmode')).toBe('numeric')
    expect(boxes().t2.getAttribute('inputmode')).toBe('numeric')
  })

  it('advances focus to team 2 after an unambiguous single digit (2-9)', () => {
    render(<ScoreEntry match={match()} onUpdate={vi.fn()} />)
    fireEvent.change(boxes().t1, { target: { value: '6' } })
    expect(document.activeElement).toBe(boxes().t2)
  })

  it('does not steal focus after an ambiguous leading digit (0 or 1)', () => {
    render(<ScoreEntry match={match()} onUpdate={vi.fn()} />)
    fireEvent.change(boxes().t1, { target: { value: '1' } })
    expect(document.activeElement).not.toBe(boxes().t2)
  })

  it('advances focus once a second digit completes a two-digit score', () => {
    render(<ScoreEntry match={match()} onUpdate={vi.fn()} />)
    fireEvent.change(boxes().t1, { target: { value: '1' } })
    fireEvent.change(boxes().t1, { target: { value: '15' } })
    expect(document.activeElement).toBe(boxes().t2)
  })

  // The auto-advance-triggered blur must commit team 1's fresh value, not the
  // one from before the keystroke — see the comment in ScoreEntry.tsx on why
  // the focus() call is deferred to an effect rather than fired inline.
  it('commits the just-typed value, not a stale one, when auto-advance fires', () => {
    const onUpdate = vi.fn()
    render(<ScoreEntry match={match()} onUpdate={onUpdate} />)
    fireEvent.change(boxes().t1, { target: { value: '6' } })
    fireEvent.change(boxes().t2, { target: { value: '4' } })
    fireEvent.blur(boxes().t2)
    expect(onUpdate).toHaveBeenCalledWith('m1', { score1: 6, score2: 4, completed: true })
  })
})
