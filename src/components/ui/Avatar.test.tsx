import { describe, expect, it } from 'vitest'
import Avatar from './Avatar'
import { propsOf } from '../../test/element'
import { letterColor } from '../../lib/letterColors'

describe('Avatar', () => {
  it('renders a letter circle coloured from the name', () => {
    const el = Avatar({ player: { name: 'ana' } })
    expect(propsOf(el).children).toBe('A')
    expect(propsOf(el).style).toEqual({ backgroundColor: letterColor('ana') })
    expect(String(propsOf(el).className)).toContain('w-9 h-9 text-sm')
    expect(String(propsOf(el).className)).toContain('text-white')
  })

  it('exposes a monotonic size scale', () => {
    const widths = (['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => {
      const el = Avatar({ player: { name: 'A' }, size })
      return Number(/w-(\d+)/.exec(String(propsOf(el).className))?.[1])
    })
    expect(widths).toEqual([7, 8, 9, 10, 14])
  })

  it('renders the photo when avatarUrl is set', () => {
    const el = Avatar({ player: { name: 'Ana', avatarUrl: 'https://example.com/a.png' } })
    expect((el as { type: string }).type).toBe('img')
    expect(propsOf(el).src).toBe('https://example.com/a.png')
    expect(String(propsOf(el).className)).toContain('object-cover')
  })

  it('a tone replaces the letter palette and suppresses the photo', () => {
    const el = Avatar({
      player: { name: 'Ana', avatarUrl: 'https://example.com/a.png' },
      tone: 'bg-orange-100 text-orange-600',
    })
    expect((el as { type: string }).type).not.toBe('img')
    expect(propsOf(el).style).toBeUndefined()
    expect(String(propsOf(el).className)).toContain('bg-orange-100 text-orange-600')
    expect(String(propsOf(el).className)).not.toContain('text-white')
  })

  it('falls back to ? for a missing name', () => {
    expect(propsOf(Avatar({ player: {} })).children).toBe('?')
  })

  it('appends extra className', () => {
    const el = Avatar({ player: { name: 'Ana' }, className: 'ring-2' })
    expect(String(propsOf(el).className).endsWith('ring-2')).toBe(true)
  })
})
