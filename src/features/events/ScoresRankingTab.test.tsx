// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ScoresRankingTab from './ScoresRankingTab'

afterEach(cleanup)

const standings = [
  {
    id: 'p1',
    player: { id: 'p1', name: 'Ada Lovelace' },
    played: 4,
    won: 3,
    lost: 1,
    pointsFor: 80,
    pointsAgainst: 60,
    points: 3,
  },
]
const matches = [{ id: 'm1', completed: true, score1: 21, score2: 15 }]

describe('ScoresRankingTab — results withheld (D-029)', () => {
  it('shows a teaser instead of standings when withheld', () => {
    render(<ScoresRankingTab standings={standings} matches={matches} withheld />)

    expect(screen.getByText(/results pending/i)).toBeTruthy()
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
    expect(screen.queryByText('Full Standings')).toBeNull()
  })

  it('shows real standings when not withheld', () => {
    render(<ScoresRankingTab standings={standings} matches={matches} withheld={false} />)

    expect(screen.queryByText(/results pending/i)).toBeNull()
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
  })

  it('defaults to not withheld when the prop is omitted', () => {
    render(<ScoresRankingTab standings={standings} matches={matches} />)

    expect(screen.queryByText(/results pending/i)).toBeNull()
  })
})
