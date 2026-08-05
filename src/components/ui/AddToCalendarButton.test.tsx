import { describe, expect, it, vi } from 'vitest'
import AddToCalendarButton from './AddToCalendarButton'
import { IconButton } from './IconButton'
import { ActionChip } from './ActionChip'
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

  it('renders the chip variant as a shared ActionChip, still link-based', () => {
    const el = AddToCalendarButton({ tournament, variant: 'chip', label: undefined })
    expect((el as { type: unknown }).type).toBe(ActionChip)
    // href, not onClick: iOS Safari blocks window.open here as a popup.
    expect(propsOf(el).href).toBe('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(propsOf(el).target).toBe('_blank')
    expect(propsOf(el).rel).toBe('noopener noreferrer')
    expect(String(propsOf(el).className ?? '')).not.toContain('w-full')
    expect(propsOf(el).title).toBe('Add to Google Calendar')
  })

  it('shortens the chip label but keeps the full one reachable as a title', () => {
    const el = AddToCalendarButton({ tournament, variant: 'chip', label: undefined })
    expect(propsOf(el).children).toBe('Add to calendar')
    expect(propsOf(el).title).toBe('Add to Google Calendar')
  })

  it('lets a caller override the chip label', () => {
    const el = AddToCalendarButton({ tournament, variant: 'chip', label: 'Save the date' })
    expect(propsOf(el).children).toBe('Save the date')
  })
})
