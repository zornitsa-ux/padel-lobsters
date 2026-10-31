// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { OscarResultsList } from './OscarResultsList'
import { groupOscarResultsByCategory } from './oscarResults'
import type { ResultRow } from './oscarsSchemas'

afterEach(cleanup)

const row = (fields: Partial<ResultRow>) =>
  ({
    category_id: 'c1',
    category_name: 'Best Smash',
    category_icon: '💥',
    display_order: 1,
    target_id: 'p1',
    target_name: 'Ana Silva',
    votes_count: 3,
    rank_in_category: 1,
    total_voters: 5,
    ...fields,
  }) as ResultRow

describe('OscarResultsList', () => {
  it('gives each category a row with its winner, votes and bars', () => {
    const categories = groupOscarResultsByCategory([
      row({}),
      row({ target_id: 'p2', target_name: 'Ben Ode', votes_count: 1, rank_in_category: 2 }),
      row({ category_id: 'c2', category_name: 'Best Lob', display_order: 2, votes_count: 0 }),
    ])
    render(<OscarResultsList categories={categories} />)

    const [smash] = screen.getAllByRole('listitem')
    expect(within(smash).getByText('Best Smash')).toBeTruthy()
    expect(within(smash).getByText('Ana Silva')).toBeTruthy()
    expect(within(smash).getByText(/3 votes/)).toBeTruthy()
    expect(within(smash).getByText('Ben')).toBeTruthy()
    expect(screen.getByRole('list').className).toContain('card')
  })

  it('inset: no card of its own, for a past event card', () => {
    render(<OscarResultsList categories={groupOscarResultsByCategory([row({})])} inset />)
    expect(screen.getByRole('list').className).not.toContain('card')
  })
})
