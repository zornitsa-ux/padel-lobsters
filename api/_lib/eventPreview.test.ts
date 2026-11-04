import { describe, expect, it } from 'vitest'
import {
  formatPreviewDate,
  imageVersion,
  isEventId,
  previewText,
  renderPreviewHtml,
  type PreviewEvent,
} from './eventPreview'

const EVENT: PreviewEvent = {
  id: '00000000-0000-4000-b000-000000000101',
  name: 'King of the Court',
  date: '2026-11-15',
  time: '10:00',
  location: 'Padel Club Amsterdam',
  format: 'king_of_court',
}

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
    expect(previewText({ event: EVENT })).toEqual({
      title: 'King of the Court',
      description:
        'Sunday 15 November · 10:00 · Padel Club Amsterdam · King of the Court. See the details and join on Padel Lobsters.',
    })
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
    })
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&#60;script&#62;')
    expect(html).toContain('<meta property="og:image" content="https://padelobsters.nl/i.png" />')
    expect(html).toContain('location.replace("https://padelobsters.nl/events/x/info?app=1")')
  })
})
