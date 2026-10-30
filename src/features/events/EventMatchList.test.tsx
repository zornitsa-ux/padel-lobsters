// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { EventMatchList } from './EventMatchList'
import type { NormalisedMatch } from './matchQueries'

afterEach(cleanup)

const match = (fields: Partial<NormalisedMatch>) =>
  ({
    id: 'm1',
    round: 1,
    court: 'Court 1',
    completed: true,
    score1: 6,
    score2: 3,
    team1Ids: ['a', 'b'],
    team2Ids: ['c', 'd'],
    ...fields,
  }) as NormalisedMatch

const nameFor = (id: string) => ({ a: 'Ana', b: 'Ben', c: 'Cas', d: 'Dee' })[id] ?? '?'

describe('EventMatchList', () => {
  it('lists each match as a row: court, teams and score, the winners in success', () => {
    render(
      <EventMatchList
        matches={[match({}), match({ id: 'm2', court: null, round: 2, completed: false })]}
        nameFor={nameFor}
      />,
    )
    const [played, unplayed] = screen.getAllByRole('listitem')
    expect(within(played).getByText('Court 1')).toBeTruthy()
    expect(within(played).getByText('Ana').parentElement!.className).toContain('text-lob-success')
    expect(within(played).getByText('Cas').parentElement!.className).not.toContain(
      'text-lob-success',
    )
    expect(within(played).getByText('6')).toBeTruthy()
    expect(within(unplayed).getByText('Round 2')).toBeTruthy()
    expect(within(unplayed).getAllByText('—')).toHaveLength(2)
  })

  it('says Draw on a level score', () => {
    render(<EventMatchList matches={[match({ score2: 6 })]} nameFor={nameFor} />)
    expect(screen.getByText('Draw')).toBeTruthy()
  })

  it('inset: no card of its own, for a past event card', () => {
    render(<EventMatchList matches={[match({})]} nameFor={nameFor} inset />)
    expect(screen.getByRole('list').className).not.toContain('card')
  })
})
