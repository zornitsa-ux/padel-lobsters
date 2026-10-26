import { describe, expect, it, vi } from 'vitest'
import AddToCalendarButton from './AddToCalendarButton'
import { IconButton } from './IconButton'
import { Button } from './Button'
import { propsOf } from '../../test/element'

vi.mock('../../lib/calendar', () => ({
  buildGoogleCalendarUrl: vi.fn(
    () => 'https://calendar.google.com/calendar/render?action=TEMPLATE',
  ),
}))

describe('AddToCalendarButton', () => {
  const tournament = { id: 't1', date: '2026-06-01', name: 'Lobster Cup' }

  it('returns null when tournament has no date', () => {
    const el = AddToCalendarButton({ tournament: { id: 't1' }, label: undefined })
    expect(el).toBeNull()
  })

  it('renders icon variant as an IconButton link with aria label', () => {
    const el = AddToCalendarButton({ tournament, variant: 'icon', label: undefined })
    expect((el as { type: unknown }).type).toBe(IconButton)
    expect(propsOf(el)['aria-label']).toBe('Add to Google Calendar')
    expect(propsOf(el).href).toBe('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(propsOf(el).external).toBe(true)
    expect(propsOf(el).variant).toBe('accent')
  })

  it('renders the full variant as a full-width secondary Button link', () => {
    const el = AddToCalendarButton({ tournament, label: undefined })
    expect((el as { type: unknown }).type).toBe(Button)
    expect(propsOf(el).variant).toBe('secondary')
    expect(propsOf(el).href).toBe('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(propsOf(el).external).toBe(true)
    expect(propsOf(el).className).toBe('w-full')
    expect(propsOf(el).children).toBe('Add to Google Calendar')
  })

  it('renders the compact variant as a small neutral Button, still link-based', () => {
    const el = AddToCalendarButton({ tournament, variant: 'compact', label: undefined })
    expect((el as { type: unknown }).type).toBe(Button)
    expect(propsOf(el).variant).toBe('neutral')
    expect(propsOf(el).size).toBe('sm')
    // href, not onClick: iOS Safari blocks window.open here as a popup.
    expect(propsOf(el).href).toBe('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(propsOf(el).external).toBe(true)
    expect(propsOf(el).title).toBe('Add to Google Calendar')
  })

  it('shortens the compact label but keeps the full one reachable as a title', () => {
    const el = AddToCalendarButton({ tournament, variant: 'compact', label: undefined })
    expect(propsOf(el).children).toBe('Add to calendar')
    expect(propsOf(el).title).toBe('Add to Google Calendar')
  })

  it('lets a caller override the compact label', () => {
    const el = AddToCalendarButton({ tournament, variant: 'compact', label: 'Save the date' })
    expect(propsOf(el).children).toBe('Save the date')
  })
})
