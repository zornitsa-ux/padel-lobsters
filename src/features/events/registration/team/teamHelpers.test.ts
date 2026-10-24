import { describe, expect, it } from 'vitest'
import type { Player } from '../../../../lib/normalise'
import {
  filterByName,
  notSignedInHint,
  EMPTY_DRAFT,
  choiceToDraft,
  draftToChoice,
  isDraftComplete,
  isLevelValid,
  rosterLine,
} from './teamHelpers'
import type { TeamEntry } from '../../teams/teamTypes'

describe('new partner draft', () => {
  const filled = { ...EMPTY_DRAFT, name: 'A', email: 'a@test.invalid', consent: true }

  it('needs consent, name and email', () => {
    expect(isDraftComplete({ draft: filled })).toBe(true)
    expect(isDraftComplete({ draft: { ...filled, consent: false } })).toBe(false)
  })

  it('accepts an empty or 0–7 level, with a comma decimal', () => {
    expect(isLevelValid({ level: '' })).toBe(true)
    expect(isLevelValid({ level: '3,5' })).toBe(true)
    expect(isLevelValid({ level: 'abc' })).toBe(false)
    expect(isLevelValid({ level: '9' })).toBe(false)
    expect(isDraftComplete({ draft: { ...filled, level: 'abc' } })).toBe(false)
  })
})

describe('choiceToDraft', () => {
  it('round-trips a new partner so Back keeps what was typed', () => {
    const draft = { name: 'A', email: 'a@test.invalid', level: '3.5', consent: true }
    expect(choiceToDraft({ choice: draftToChoice({ draft }) })).toEqual(draft)
  })

  it('starts empty for a member or no choice', () => {
    expect(choiceToDraft({ choice: { kind: 'member', playerId: 'p1' } })).toEqual(EMPTY_DRAFT)
    expect(choiceToDraft({ choice: null })).toEqual(EMPTY_DRAFT)
  })
})

describe('notSignedInHint', () => {
  it('names whoever has not signed in', () => {
    expect(notSignedInHint({ captainUnseen: false, partnerUnseen: false })).toBeNull()
    expect(notSignedInHint({ captainUnseen: false, partnerUnseen: true })).toMatch(/^Partner/)
    expect(notSignedInHint({ captainUnseen: true, partnerUnseen: false })).toMatch(/^Captain/)
    expect(notSignedInHint({ captainUnseen: true, partnerUnseen: true })).toMatch(/^Neither/)
  })
})

describe('filterByName', () => {
  const players = [
    { id: '1', name: 'Nicolas Garcia' },
    { id: '2', name: 'Elena Jiménez' },
    { id: '3', name: 'Nina Holt' },
  ] as Player[]
  const ids = (search: string) => filterByName({ players, search }).map((p) => p.id)

  it('matches a few letters anywhere, ignoring case and accents', () => {
    expect(ids('NIC')).toEqual(['1'])
    expect(ids('jime')).toEqual(['2'])
    expect(ids('ni')).toEqual(['1', '3'])
  })
  it('matches several fragments in any order', () => {
    expect(ids('gar nic')).toEqual(['1'])
    expect(ids('  nic   holt ')).toEqual([])
  })
  it('shows everyone for an empty search', () => {
    expect(ids('   ')).toHaveLength(3)
  })
})

describe('rosterLine', () => {
  const entry = (status: TeamEntry['status']) => ({ status }) as TeamEntry

  it('counts the team entries, so it matches the team lists', () => {
    expect(
      rosterLine({
        entries: [entry('registered'), entry('registered'), entry('waitlist')],
        maxPlayers: 20,
      }),
    ).toEqual({ main: '2 of 10 teams', waiting: '1 team waiting' })
  })

  it('has no waiting part with an empty waitlist', () => {
    expect(rosterLine({ entries: [entry('registered')], maxPlayers: 20 }).waiting).toBeNull()
  })
})
