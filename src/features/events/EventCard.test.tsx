// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EventCard } from './EventCard'
import type { NormalisedTournament } from '../../lib/normalise'

const tournament = (over: Partial<NormalisedTournament>) =>
  ({
    id: 't1',
    name: 'Event',
    date: '2026-01-10',
    time: '10:00',
    duration: 90,
    status: 'upcoming',
    format: 'king_of_court',
    ...over,
  }) as NormalisedTournament

const renderCard = (t: NormalisedTournament) =>
  render(
    <MemoryRouter>
      <EventCard tournament={t} past />
    </MemoryRouter>,
  )

describe('EventCard', () => {
  afterEach(cleanup)

  it('marks King of the Court completed once its scheduled end has passed (D-026)', () => {
    renderCard(tournament({}))
    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.queryByText('Upcoming')).toBeNull()
  })

  it('marks a finished Americano completed', () => {
    renderCard(tournament({ format: 'lobster_matching', status: 'completed' }))
    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.queryByText('Upcoming')).toBeNull()
  })
})
