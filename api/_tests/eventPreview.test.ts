import { describe, expect, it } from 'vitest'
import {
  appUrlFor,
  formatPreviewDate,
  isClosed,
  imageVersion,
  isEventId,
  previewText,
  renderPreviewHtml,
  todayInAmsterdam,
  type PreviewEvent,
} from '../_lib/eventPreview'

const EVENT: PreviewEvent = {
  id: '00000000-0000-4000-b000-000000000101',
  name: 'King of the Court',
  date: '2026-11-15',
  time: '10:00',
  location: 'Padel Club Amsterdam',
  format: 'king_of_court',
  status: 'upcoming',
}
const TODAY = '2026-11-04'

describe('event preview', () => {
  it('accepts only uuids as event ids', () => {
    expect(isEventId(EVENT.id)).toBe(true)
    expect(isEventId('evt-1')).toBe(false)
    expect(isEventId('x&select=*')).toBe(false)
    expect(isEventId(null)).toBe(false)
  })

  it('formats the calendar date without shifting the day', () => {
    expect(formatPreviewDate(EVENT)).toBe('Sunday 15 November · 10:00')
    expect(formatPreviewDate({ date: '2026-11-15', time: null })).toBe('Sunday 15 November')
    expect(formatPreviewDate({ date: null, time: '10:00' })).toBe('')
  })

  it('writes the title and description from event facts only', () => {
    expect(previewText({ event: EVENT, today: TODAY })).toEqual({
      title: 'King of the Court',
      description:
        'Sunday 15 November · 10:00 · Padel Club Amsterdam · King of the Court. See the details and join on Padel Lobsters.',
    })
  })

  it('says sign-ups are closed once an event has started, finished or passed', () => {
    expect(isClosed({ event: EVENT, today: TODAY })).toBe(false)
    expect(isClosed({ event: { ...EVENT, status: 'active' }, today: TODAY })).toBe(true)
    expect(isClosed({ event: { ...EVENT, status: 'completed' }, today: TODAY })).toBe(true)
    expect(isClosed({ event: EVENT, today: '2026-11-16' })).toBe(true)
    expect(
      previewText({ event: { ...EVENT, status: 'completed' }, today: TODAY }).description,
    ).toMatch(/Sign-ups are closed\. See what's coming up on Padel Lobsters\.$/)
  })

  it('sends a person back to the link they opened, keeping its query', () => {
    const search = new URLSearchParams({ id: EVENT.id, tab: 'info', src: 'wa' })
    expect(
      appUrlFor({ origin: 'https://padelobsters.nl', id: EVENT.id, tab: 'info', search }),
    ).toBe(`https://padelobsters.nl/events/${EVENT.id}/info?src=wa&app=1`)
    expect(
      appUrlFor({
        origin: 'https://padelobsters.nl',
        id: EVENT.id,
        tab: null,
        search: new URLSearchParams(),
      }),
    ).toBe(`https://padelobsters.nl/events/${EVENT.id}?app=1`)
  })

  it('changes the image version when a shown fact changes', () => {
    const v = imageVersion({ event: EVENT })
    expect(imageVersion({ event: { ...EVENT } })).toBe(v)
    expect(imageVersion({ event: { ...EVENT, time: '11:00' } })).not.toBe(v)
  })

  it('escapes event text in the HTML', () => {
    const html = renderPreviewHtml({
      title: 'Fun <script>alert(1)</script> & "games"',
      description: 'd',
      pageUrl: 'https://padelobsters.nl/events/x/info',
      imageUrl: 'https://padelobsters.nl/i.png',
      appUrl: 'https://padelobsters.nl/events/x/info?app=1',
    })
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&#60;script&#62;')
    expect(html).toContain('<meta property="og:image" content="https://padelobsters.nl/i.png" />')
    expect(html).toContain('location.replace("https://padelobsters.nl/events/x/info?app=1")')
  })

  it("takes today from Amsterdam's calendar, not UTC", () => {
    // 23:30 UTC on 14 Nov is 00:30 on 15 Nov in Amsterdam.
    expect(todayInAmsterdam(new Date('2026-11-14T23:30:00Z'))).toBe('2026-11-15')
    expect(todayInAmsterdam(new Date('2026-11-14T12:00:00Z'))).toBe('2026-11-14')
  })
})
