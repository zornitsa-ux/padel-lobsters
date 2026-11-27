import { describe, expect, it } from 'vitest'
import { eventTodos, isWrappedUp } from './eventTodos'

const scored = { completed: true, score1: 6, score2: 3 }
const unscored = { completed: false, score1: null, score2: null }
const SHARED = '2026-07-29T21:00:00Z'
// 2026-07-29 19:00 + 120 minutes ends at 21:00 local.
const AFTER = new Date(2026, 6, 29, 22)
const DURING = new Date(2026, 6, 29, 20)

const americano = (over: Record<string, unknown> = {}) => ({
  status: 'upcoming',
  format: 'lobster_matching',
  date: '2026-07-29',
  time: '19:00',
  duration: 120,
  resultsSharedAt: null,
  ...over,
})
const kotc = (over: Record<string, unknown> = {}) => americano({ format: 'king_of_court', ...over })

const ids = (todos: { id: string }[]) => todos.map((t) => t.id)

describe('eventTodos', () => {
  it('gives Americano scores, ratings and the reveal, all required', () => {
    const todos = eventTodos({ tournament: americano(), matches: [scored, unscored] })
    expect(ids(todos)).toEqual(['enter_scores', 'apply_ratings', 'reveal_standings'])
    expect(todos.every((t) => t.required && !t.done)).toBe(true)
  })

  it('marks each Americano to-do done from its own data', () => {
    const tournament = americano({ status: 'completed', resultsSharedAt: SHARED })
    const todos = eventTodos({ tournament, matches: [scored] })
    expect(todos.every((t) => t.done)).toBe(true)
  })

  it('counts an empty schedule as scores still to enter', () => {
    const [scores] = eventTodos({ tournament: americano(), matches: [] })
    expect(scores).toEqual({ id: 'enter_scores', required: true, done: false })
  })

  it('gives King of the Court only the optional placings', () => {
    expect(eventTodos({ tournament: kotc(), matches: [] })).toEqual([
      { id: 'save_placings', required: false, done: false },
    ])
    expect(eventTodos({ tournament: kotc(), matches: [], hasFinalStandings: true })).toEqual([
      { id: 'save_placings', required: false, done: true },
    ])
  })
})

describe('isWrappedUp', () => {
  const done = americano({ status: 'completed', resultsSharedAt: SHARED })

  it('wraps up an Americano once finished and every required to-do is done', () => {
    expect(isWrappedUp({ tournament: done, matches: [scored], now: AFTER })).toBe(true)
  })

  it('is not wrapped up while a required to-do is left', () => {
    const unrevealed = americano({ status: 'completed' })
    expect(isWrappedUp({ tournament: unrevealed, matches: [scored], now: AFTER })).toBe(false)
    expect(isWrappedUp({ tournament: americano(), matches: [scored], now: AFTER })).toBe(false)
  })

  it('never wraps up an Americano with no schedule', () => {
    expect(isWrappedUp({ tournament: done, matches: [], now: AFTER })).toBe(false)
  })

  it('wraps up King of the Court at its end, placings saved or not', () => {
    expect(isWrappedUp({ tournament: kotc(), matches: [], now: DURING })).toBe(false)
    expect(isWrappedUp({ tournament: kotc(), matches: [], now: AFTER })).toBe(true)
  })
})
