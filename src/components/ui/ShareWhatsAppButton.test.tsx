import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShareWhatsAppButton from './ShareWhatsAppButton'
import { IconButton } from './IconButton'
import { propsOf } from '../../test/element'

const tournament = {
  id: 't1',
  name: 'Lobster Cup',
  date: '2026-06-01',
  time: '19:00',
  location: 'Padelbaan Amsterdam',
}

// The share text is only observable through the wa.me URL the handler opens.
const openedText = (el: unknown) => {
  const onClick = propsOf(el).onClick as (e?: unknown) => void
  onClick()
  const url = vi.mocked(window.open).mock.calls[0][0] as string
  expect(url.startsWith('https://wa.me/?text=')).toBe(true)
  return decodeURIComponent(url.slice('https://wa.me/?text='.length))
}

beforeEach(() => {
  vi.stubGlobal('window', {
    location: { origin: 'https://padelobsters.nl' },
    open: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ShareWhatsAppButton', () => {
  it('renders nothing without a tournament id', () => {
    expect(ShareWhatsAppButton({ tournament: undefined })).toBeNull()
    expect(ShareWhatsAppButton({ tournament: null })).toBeNull()
    expect(ShareWhatsAppButton({ tournament: { name: 'No id' } })).toBeNull()
  })

  it('renders the icon variant as a success IconButton', () => {
    const el = ShareWhatsAppButton({ tournament })
    expect((el as { type: unknown }).type).toBe(IconButton)
    expect(propsOf(el)['aria-label']).toBe('Share on WhatsApp')
    expect(propsOf(el).variant).toBe('success')
  })

  it('renders the full variant as a wide button', () => {
    const el = ShareWhatsAppButton({ tournament, variant: 'full' })
    expect((el as { type: unknown }).type).toBe('button')
    expect(String(propsOf(el).className)).toContain('w-full')
  })

  it('builds the share text with name, date, time, location and event URL', () => {
    const text = openedText(ShareWhatsAppButton({ tournament }))
    // The intended blank separator line is dropped by `.filter(Boolean)`.
    expect(text).toBe(
      '🦞 Lobster Cup\n' +
        '📅 Monday, 1 June 2026 at 19:00\n' +
        '📍\nPadelbaan Amsterdam\n' +
        'Register & see details:\n' +
        'https://padelobsters.nl/events/t1',
    )
  })

  it('drops the date line when the date is missing or unparseable', () => {
    expect(openedText(ShareWhatsAppButton({ tournament: { id: 't1', name: 'X' } }))).toBe(
      '🦞 X\nRegister & see details:\nhttps://padelobsters.nl/events/t1',
    )
    vi.mocked(window.open).mockClear()
    expect(
      openedText(ShareWhatsAppButton({ tournament: { id: 't1', name: 'X', date: 'nope' } })),
    ).toBe('🦞 X\nRegister & see details:\nhttps://padelobsters.nl/events/t1')
  })

  it('falls back to a generic name and omits time / location when absent', () => {
    const text = openedText(ShareWhatsAppButton({ tournament: { id: 't2', date: '2026-06-01' } }))
    expect(text).toBe(
      '🦞 Padel Lobsters Event\n' +
        '📅 Monday, 1 June 2026\n' +
        'Register & see details:\n' +
        'https://padelobsters.nl/events/t2',
    )
  })

  it('opens in a new tab', () => {
    openedText(ShareWhatsAppButton({ tournament }))
    expect(vi.mocked(window.open).mock.calls[0][1]).toBe('_blank')
  })
})
