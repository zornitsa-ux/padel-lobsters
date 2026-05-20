import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import AddToCalendarButton from './AddToCalendarButton'

vi.mock('../../lib/calendar', () => ({
  buildGoogleCalendarUrl: vi.fn(
    () => 'https://calendar.google.com/calendar/render?action=TEMPLATE',
  ),
}))

describe('AddToCalendarButton', () => {
  const tournament = { id: 't1', date: '2026-06-01', name: 'Lobster Cup' }

  it('returns null when tournament has no date', () => {
    const el = AddToCalendarButton({ tournament: { id: 't1' } as any, label: undefined })
    expect(el).toBeNull()
  })

  it('renders icon variant as anchor with aria label', () => {
    const el = AddToCalendarButton({ tournament, variant: 'icon', label: undefined }) as any
    expect(el.type).toBe('a')
    expect(el.props['aria-label']).toBe('Add to Google Calendar')
  })

  it('renders full variant label by default', () => {
    const el = AddToCalendarButton({ tournament, label: undefined }) as any
    const children = el.props.children
    const textChild = Array.isArray(children) ? children[1] : children
    expect(textChild).toBe('Add to Google Calendar')
  })
})
