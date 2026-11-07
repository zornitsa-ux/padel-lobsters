import { describe, expect, it } from 'vitest'
import { buildEventShareMessage, eventShareUrl } from './eventShareMessage'

const url = 'https://padelobsters.nl/events/t1'

const event = {
  id: 't1',
  name: 'Lobster Cup',
  date: '2026-11-15',
  time: '10:30',
  duration: 90,
  location: 'Padel Club Amsterdam',
  format: 'americano',
  totalPrice: 200,
  maxPlayers: 16,
  entryMode: 'individual' as const,
}

describe('buildEventShareMessage', () => {
  it('lists the event facts, spots left and the sign-up link', () => {
    expect(buildEventShareMessage({ event, url, registeredCount: 12 })).toBe(
      [
        '🦞 LOBSTER CUP',
        '',
        '📅 Sunday 15 Nov, 10:30 (90 min)',
        '📍 Padel Club Amsterdam',
        '🎾 Americano',
        '💶 €12.50 per player',
        '✅ 4 spots left',
        '',
        `Sign up: ${url}`,
      ].join('\n'),
    )
  })

  it('writes single-digit days without a leading zero', () => {
    expect(buildEventShareMessage({ event: { ...event, date: '2026-12-05' }, url })).toContain(
      '📅 Saturday 5 Dec, 10:30 (90 min)',
    )
  })

  it('points a full event at the waitlist', () => {
    expect(buildEventShareMessage({ event, url, registeredCount: 16 })).toContain(
      '✅ Full, join the waitlist',
    )
  })

  it('counts teams on a team event', () => {
    expect(
      buildEventShareMessage({
        event: { ...event, entryMode: 'team' },
        url,
        registeredCount: 10,
      }),
    ).toContain('✅ 3 teams left')
  })

  it('leaves out what it does not know', () => {
    expect(buildEventShareMessage({ event: { id: 't1' }, url })).toBe(
      `🦞 PADEL LOBSTERS EVENT\n\nSign up: ${url}`,
    )
  })

  it('drops a free price and an unparseable date', () => {
    const text = buildEventShareMessage({
      event: { ...event, totalPrice: 0, date: 'nope', time: '' },
      url,
    })
    expect(text).not.toContain('💶')
    expect(text).not.toContain('📅')
    expect(text).not.toContain('✅')
  })
})

describe('eventShareUrl', () => {
  it('links to the bare event page', () => {
    expect(eventShareUrl({ event, origin: 'https://padelobsters.nl' })).toBe(url)
  })
})
