import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import StatRow from './StatRow'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { propsOf, childrenOf } from '../../test/element'
import type { AdminStatRow, CategoryVoterRow } from './oscarsSchemas'

// StatRow holds no state, so it can be called as a plain function and the
// returned element inspected — enough to pin the divide-by-zero guard and the
// shared ProgressBar wiring without a DOM.

const typeOf = (el: unknown) => (el as ReactElement).type

const stat = (votes: number, participants: number): AdminStatRow => ({
  category_id: 'c1',
  category_name: 'Best Lobster',
  category_icon: '🦞',
  display_order: 0,
  votes_count: votes,
  total_participants: participants,
})

const voter = (id: string, voted: boolean): CategoryVoterRow => ({
  player_id: id,
  player_name: `Player ${id}`,
  voted,
})

const render = (
  votes: number,
  participants: number,
  expanded = false,
  voters?: CategoryVoterRow[],
) => StatRow({ stat: stat(votes, participants), expanded, voters, onToggle: vi.fn() })

// The bar is the trigger button's second child, after the label row.
const barOf = (el: unknown) => childrenOf(childrenOf(el)[0])[1]

// A column header reads "✓ Voted (1)" — its children are text/number fragments.
const headerTextOf = (column: unknown) => childrenOf(childrenOf(column)[0]).join('')

describe('StatRow', () => {
  it('renders participation as a percentage on the shared ProgressBar', () => {
    const bar = barOf(render(3, 4))

    expect(typeOf(bar)).toBe(ProgressBar)
    expect(propsOf(bar).value).toBe(75)
  })

  it('reports 0% rather than NaN when nobody is registered', () => {
    expect(propsOf(barOf(render(0, 0))).value).toBe(0)
  })

  it('rounds to the nearest percent', () => {
    expect(propsOf(barOf(render(1, 3))).value).toBe(33)
  })

  it('renders no voter breakdown while collapsed', () => {
    const el = render(1, 2, false, [voter('p1', true), voter('p2', false)])

    expect(childrenOf(el).filter(Boolean)).toHaveLength(1)
  })

  it('splits voters into voted and not-yet columns when expanded', () => {
    const el = render(1, 3, true, [voter('p1', true), voter('p2', false), voter('p3', false)])
    const [votedColumn, notVotedColumn] = childrenOf(childrenOf(el)[1])

    expect(headerTextOf(votedColumn)).toBe('✓ Voted (1)')
    expect(headerTextOf(notVotedColumn)).toBe('○ Not yet (2)')
  })

  it('counts nobody when the voter list has not loaded yet', () => {
    const el = render(1, 3, true, undefined)
    const [votedColumn, notVotedColumn] = childrenOf(childrenOf(el)[1])

    expect(headerTextOf(votedColumn)).toBe('✓ Voted (0)')
    expect(headerTextOf(notVotedColumn)).toBe('○ Not yet (0)')
  })
})
