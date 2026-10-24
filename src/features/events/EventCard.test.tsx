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

const badgeOf = (t: NormalisedTournament) => {
  render(
    <MemoryRouter>
      <EventCard tournament={t} past />
    </MemoryRouter>,
  )
  return ['Completed', 'Results pending', 'Upcoming'].filter((label) => screen.queryByText(label))
}

describe('EventCard', () => {
  afterEach(cleanup)

  it('marks King of the Court completed once its scheduled end has passed (D-026)', () => {
    expect(badgeOf(tournament({}))).toEqual(['Completed'])
  })

  it('marks an Americano past its date but not finished as results pending', () => {
    expect(badgeOf(tournament({ format: 'lobster_matching' }))).toEqual(['Results pending'])
  })

  it('marks a finished Americano completed', () => {
    const finished = tournament({ format: 'lobster_matching', status: 'completed' })
    expect(badgeOf(finished)).toEqual(['Completed'])
  })

  it('marks a future event upcoming', () => {
    expect(badgeOf(tournament({ date: '2099-01-10' }))).toEqual(['Upcoming'])
  })
})
