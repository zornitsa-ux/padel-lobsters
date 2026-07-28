// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ResultsView from './ResultsView'
import type { ResultRow } from './oscarsSchemas'

const row = (
  over: Partial<ResultRow> & Pick<ResultRow, 'category_id' | 'target_id'>,
): ResultRow => ({
  category_name: 'Best Lobster',
  category_icon: '🦞',
  display_order: 0,
  target_name: 'Ada',
  votes_count: 1,
  rank_in_category: 1,
  ...over,
})

afterEach(cleanup)

describe('ResultsView', () => {
  it('tells the reader nothing was voted on when there are no rows', () => {
    render(<ResultsView results={[]} />)

    expect(screen.getByText('No votes were cast.')).toBeTruthy()
  })

  it('orders categories by display_order', () => {
    render(
      <ResultsView
        results={[
          row({ category_id: 'c2', target_id: 'p1', category_name: 'Second', display_order: 1 }),
          row({ category_id: 'c1', target_id: 'p2', category_name: 'First', display_order: 0 }),
        ]}
      />,
    )

    const names = screen.getAllByText(/First|Second/).map((el) => el.textContent)
    expect(names).toEqual(['First', 'Second'])
  })

  it('groups every row of a category together and singularises the vote count', () => {
    render(
      <ResultsView
        results={[
          row({ category_id: 'c1', target_id: 'p1', target_name: 'Ada', votes_count: 3 }),
          row({
            category_id: 'c1',
            target_id: 'p2',
            target_name: 'Grace',
            votes_count: 1,
            rank_in_category: 2,
          }),
        ]}
      />,
    )

    expect(screen.getByText('Ada')).toBeTruthy()
    expect(screen.getByText('3 votes')).toBeTruthy()
    expect(screen.getByText('1 vote')).toBeTruthy()
  })

  it('joins tied winners and labels the tie', () => {
    render(
      <ResultsView
        results={[
          row({ category_id: 'c1', target_id: 'p1', target_name: 'Ada', votes_count: 2 }),
          row({ category_id: 'c1', target_id: 'p2', target_name: 'Grace', votes_count: 2 }),
        ]}
      />,
    )

    expect(screen.getByText(/Ada, Grace/)).toBeTruthy()
    expect(screen.getByText('(tied)')).toBeTruthy()
    expect(screen.getByText('2 votes each')).toBeTruthy()
  })

  it('hides a collapsible category until it is tapped', () => {
    render(
      <ResultsView
        collapsible
        results={[row({ category_id: 'c1', target_id: 'p1', target_name: 'Ada', votes_count: 2 })]}
      />,
    )

    expect(screen.getByText('tap to reveal')).toBeTruthy()
    expect(screen.queryByText('Ada')).toBeNull()

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Ada')).toBeTruthy()
    expect(screen.queryByText('tap to reveal')).toBeNull()
  })

  it('renders every category open when not collapsible', () => {
    render(
      <ResultsView
        results={[row({ category_id: 'c1', target_id: 'p1', target_name: 'Ada', votes_count: 2 })]}
      />,
    )

    expect(screen.getByText('Ada')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
