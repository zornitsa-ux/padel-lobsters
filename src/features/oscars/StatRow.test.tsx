import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import StatRow from './StatRow'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { CollapsibleCard } from '../../components/ui/CollapsibleCard'
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

// StatRow returns a CollapsibleCard: the bar is its always-visible summary and
// the voter columns are its body.
const barOf = (el: unknown) => propsOf(el).summary
const columnsOf = (el: unknown) => childrenOf(propsOf(el).children)

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

  it('is a CollapsibleCard that follows `expanded`', () => {
    const el = render(1, 2, false, [voter('p1', true), voter('p2', false)])

    expect(typeOf(el)).toBe(CollapsibleCard)
    expect(propsOf(el).expanded).toBe(false)
  })

  it('splits voters into voted and not-yet columns when expanded', () => {
    const el = render(1, 3, true, [voter('p1', true), voter('p2', false), voter('p3', false)])
    const [votedColumn, notVotedColumn] = columnsOf(el)

    expect(headerTextOf(votedColumn)).toBe('✓ Voted (1)')
    expect(headerTextOf(notVotedColumn)).toBe('○ Not yet (2)')
  })

  it('counts nobody when the voter list has not loaded yet', () => {
    const el = render(1, 3, true, undefined)
    const [votedColumn, notVotedColumn] = columnsOf(el)

    expect(headerTextOf(votedColumn)).toBe('✓ Voted (0)')
    expect(headerTextOf(notVotedColumn)).toBe('○ Not yet (0)')
  })
})
