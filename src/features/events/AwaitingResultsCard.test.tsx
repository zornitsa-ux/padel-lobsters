// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AwaitingResultsCard } from './AwaitingResultsCard'
import type { NormalisedTournament } from '../../lib/normalise'

const tournament = {
  id: 't1',
  name: 'Sunday Americano',
  date: '2026-01-10',
  time: '10:00',
  location: 'Club',
  status: 'upcoming',
  format: 'lobster_matching',
} as NormalisedTournament

describe('AwaitingResultsCard', () => {
  afterEach(cleanup)

  it('links to the event and says results are pending, never upcoming', () => {
    render(
      <MemoryRouter>
        <AwaitingResultsCard tournament={tournament} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('/events/t1')
    expect(screen.getByText('Results pending')).toBeTruthy()
    expect(screen.getByText('10:00 · Club')).toBeTruthy()
    expect(screen.queryByText('Upcoming')).toBeNull()
  })
})
