import { describe, it, expect } from 'vitest'
import { parseLocalDate, formatDate, formatLabel, pricePerPlayer } from './eventHelpers'
import { DEFAULT_EVENT_DESCRIPTION, emptyForm } from './eventConstants'
import { shortName } from './scheduleHelpers'

describe('parseLocalDate', () => {
  it('reads a date-only string as local midnight, not UTC', () => {
    const d = parseLocalDate('2026-08-01')

    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(7)
    expect(d?.getDate()).toBe(1)
    expect(d?.getHours()).toBe(0)
  })

  it('ignores a trailing time component on a date-only prefix', () => {
    expect(parseLocalDate('2026-08-01T22:00:00Z')?.getDate()).toBe(1)
  })

  it('falls back to Date parsing for other formats', () => {
    expect(parseLocalDate('August 1, 2026')?.getMonth()).toBe(7)
  })

  it('returns null for empty or unparseable input', () => {
    expect(parseLocalDate('')).toBeNull()
    expect(parseLocalDate(null)).toBeNull()
    expect(parseLocalDate('not a date')).toBeNull()
  })
})

describe('formatDate', () => {
  it('renders weekday, day and short month', () => {
    expect(formatDate('2026-08-01')).toBe('Sat 1 Aug')
  })

  it('renders an em dash when there is no date', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
})

describe('formatLabel', () => {
  it('maps known format keys to display names', () => {
    expect(formatLabel('lobster_matching')).toBe('Lobster Matching')
    expect(formatLabel('roundrobin')).toBe('Round Robin')
  })

  it('passes unknown keys straight through', () => {
    expect(formatLabel('padel_royale')).toBe('padel_royale')
  })
})

describe('pricePerPlayer', () => {
  it('divides the total by max players in admin_all mode', () => {
    expect(pricePerPlayer({ courtBookingMode: 'admin_all', totalPrice: 160, maxPlayers: 16 })).toBe(
      10,
    )
  })

  it('coerces string column values', () => {
    expect(pricePerPlayer({ totalPrice: '160', maxPlayers: '8' })).toBe(20)
  })

  it('defaults to 16 players when maxPlayers is missing or unusable', () => {
    expect(pricePerPlayer({ totalPrice: 160 })).toBe(10)
  })

  it('is free when no total price is set', () => {
    expect(pricePerPlayer({ courtBookingMode: 'admin_all', totalPrice: 0 })).toBe(0)
    expect(pricePerPlayer({})).toBe(0)
  })

  it('sums the per-court shares in player_responsible mode', () => {
    expect(
      pricePerPlayer({
        courtBookingMode: 'player_responsible',
        courts: [{ costPerPerson: '7.5' }, { costPerPerson: 2.5 }, { costPerPerson: null }],
      }),
    ).toBe(10)
  })

  it('is free when player_responsible has no courts', () => {
    expect(pricePerPlayer({ courtBookingMode: 'player_responsible' })).toBe(0)
  })
})

describe('emptyForm', () => {
  it('starts a new event on the only supported format (D-020/D-028)', () => {
    expect(emptyForm.format).toBe('lobster_matching')
  })

  it('prefills the shared description and one blank court', () => {
    expect(emptyForm.notes).toBe(DEFAULT_EVENT_DESCRIPTION)
    expect(emptyForm.courts).toEqual([
      { name: '', booked: false, costPerPerson: '', responsible: '', tikkieLink: '' },
    ])
  })
})

describe('shortName', () => {
  const ada = { id: 'p1', name: 'Ada Lovelace' }
  const grace = { id: 'p2', name: 'Grace Hopper' }

  it('uses the first name when it is unambiguous', () => {
    expect(shortName(ada, [ada, grace])).toBe('Ada')
  })

  it('adds a last initial when two players share a first name', () => {
    const adaB = { id: 'p3', name: 'Ada Byron' }

    expect(shortName(ada, [ada, adaB])).toBe('Ada L.')
    expect(shortName(adaB, [ada, adaB])).toBe('Ada B.')
  })

  it('falls back to the full name when a duplicate has no surname', () => {
    const mono = { id: 'p4', name: 'Ada' }
    const adaB = { id: 'p3', name: 'Ada Byron' }

    expect(shortName(mono, [mono, adaB])).toBe('Ada')
  })

  it('does not compare a player against themselves', () => {
    expect(shortName(ada, [ada])).toBe('Ada')
  })
})
