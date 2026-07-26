import { describe, expect, it, vi } from 'vitest'
import { PlayerRow } from './PlayerRow'
import Avatar from './Avatar'
import { propsOf, childrenOf } from '../../test/element'

const slots = (el: unknown) => childrenOf(propsOf(el).children)

describe('PlayerRow', () => {
  it('renders a div shell with avatar, name and subtitle', () => {
    const el = PlayerRow({ player: { name: 'Ana' }, name: 'Ana Diaz', subtitle: 'Level 3.5' })
    expect((el as { type: string }).type).toBe('div')
    expect(propsOf(el).className).toBe('flex items-center gap-3')

    const [prefix, leading, column] = slots(el)
    expect(prefix).toBeUndefined()
    expect(propsOf(leading).player).toEqual({ name: 'Ana' })
    expect((leading as { type: unknown }).type).toBe(Avatar)
    expect(propsOf(leading).size).toBe('md')

    const [nameEl, subtitleEl] = childrenOf(column)
    expect(propsOf(nameEl).className).toBe('font-semibold text-sm text-lob-dark truncate')
    expect(propsOf(nameEl).children).toBe('Ana Diaz')
    expect(propsOf(subtitleEl).className).toBe('text-xs text-lob-muted')
    expect(propsOf(subtitleEl).children).toBe('Level 3.5')
    expect(propsOf(column).className).toBe('flex-1 min-w-0')
  })

  it('omits the subtitle paragraph when there is no subtitle', () => {
    const el = PlayerRow({ player: { name: 'Ana' }, name: 'Ana' })
    const [, , column] = slots(el)
    expect(childrenOf(column)[1]).toBeFalsy()
  })

  it('forwards avatar size and tone', () => {
    const el = PlayerRow({
      player: { name: 'Ana' },
      name: 'Ana',
      avatarSize: 'xs',
      avatarTone: 'bg-orange-100 text-orange-600',
    })
    const [, leading] = slots(el)
    expect(propsOf(leading).size).toBe('xs')
    expect(propsOf(leading).tone).toBe('bg-orange-100 text-orange-600')
  })

  it('prefers a custom avatar node over the player avatar', () => {
    const el = PlayerRow({ player: { name: 'Ana' }, name: 'Ana', avatar: 'CUSTOM' })
    expect(slots(el)[1]).toBe('CUSTOM')
  })

  it('renders prefix, extra children and the trailing slot', () => {
    const el = PlayerRow({
      name: 'Team A',
      prefix: '#1',
      children: 'BADGES',
      trailing: 'ACTION',
    })
    const [prefix, leading, column, trailing] = slots(el)
    expect(prefix).toBe('#1')
    expect(leading).toBeNull()
    expect(trailing).toBe('ACTION')
    expect(childrenOf(column)[2]).toBe('BADGES')
  })

  it('overrides the name styling when asked', () => {
    const el = PlayerRow({ name: 'Ana', nameClassName: 'text-sm line-through' })
    const [, , column] = slots(el)
    expect(propsOf(childrenOf(column)[0]).className).toBe('text-sm line-through')
  })

  it('renders a button shell when onClick is supplied', () => {
    const onClick = vi.fn()
    const el = PlayerRow({ name: 'Ana', onClick, disabled: true, className: 'p-3 rounded-2xl' })
    expect((el as { type: string }).type).toBe('button')
    expect(propsOf(el).type).toBe('button')
    expect(propsOf(el).onClick).toBe(onClick)
    expect(propsOf(el).disabled).toBe(true)
    expect(propsOf(el).className).toBe('flex items-center gap-3 p-3 rounded-2xl text-left')
  })
})
