import { describe, expect, it } from 'vitest'
import { buildGoogleCalendarUrl, buildTournamentIcs, downloadTournamentIcs } from './calendar'

describe('calendar helpers', () => {
  it('returns null outputs when tournament date is missing', () => {
    expect(buildTournamentIcs({ id: 't1' } as any)).toBeNull()
    expect(buildGoogleCalendarUrl({ id: 't1' } as any)).toBeNull()
    expect(downloadTournamentIcs({ id: 't1' } as any)).toBe(false)
  })

  it('builds an ICS payload with event and alarm blocks', () => {
    const ics = buildTournamentIcs({
      id: 't1',
      name: 'Lobster Open',
      date: '2026-06-20',
      time: '19:30',
      duration: 120,
      location: 'Amsterdam',
      format: 'Americano',
      maxPlayers: 16,
    })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain('TRIGGER;RELATED=START:-PT24H')
    expect(ics).toContain('TRIGGER;RELATED=START:-PT2H')
  })

  it('builds a Google Calendar URL with key event params', () => {
    const url = buildGoogleCalendarUrl({
      id: 't2',
      name: 'Lobster Cup',
      date: '2026-06-21',
      time: '20:00',
      duration: 90,
      location: 'Rotterdam',
    })

    expect(url).toBeTruthy()
    const parsed = new URL(url as string)
    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE')
    expect(parsed.searchParams.get('text')).toContain('Lobster Cup')
    expect(parsed.searchParams.get('location')).toBe('Rotterdam')
    expect(parsed.searchParams.get('dates')).toContain('/')
  })
})
