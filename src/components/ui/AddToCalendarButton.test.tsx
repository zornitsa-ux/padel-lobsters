import { describe, expect, it, vi } from 'vitest'
import AddToCalendarButton from './AddToCalendarButton'
import { IconButton } from './IconButton'
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
    expect(propsOf(el).variant).toBe('accent')
  })

  it('renders full variant label by default', () => {
    const el = AddToCalendarButton({ tournament, label: undefined })
    const children = propsOf(el).children
    const textChild = Array.isArray(children) ? children[1] : children
    expect(textChild).toBe('Add to Google Calendar')
  })
})
