import { describe, expect, it, vi } from 'vitest'
import { ImageTile, OptionTile } from './OptionTile'
import { propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('OptionTile', () => {
  it('is a white bordered tile button with a teal hover', () => {
    const onClick = vi.fn()
    const el = OptionTile({ children: 'Best smash', onClick })
    expect(el.type).toBe('button')
    expect(propsOf(el).onClick).toBe(onClick)
    expect(propsOf(el)['aria-pressed']).toBeUndefined()
    expect(classOf(el)).toContain(
      'bg-white border-lob-line-strong not-disabled:hover:border-lob-teal',
    )
  })

  it('tints teal and sets aria-pressed when selected', () => {
    const el = OptionTile({ children: 'Ana', selected: true, onClick: () => {} })
    expect(classOf(el)).toContain('bg-lob-teal-light border-lob-teal')
    expect(propsOf(el)['aria-pressed']).toBe(true)
  })

  it('is a read-only div with no onClick, to or href', () => {
    const el = OptionTile({ children: 'Recap' })
    expect(el.type).toBe('div')
    expect(classOf(el)).not.toContain('hover')
  })

  it('passes disabled through', () => {
    const el = OptionTile({ children: 'You', disabled: true, onClick: () => {} })
    expect(propsOf(el).disabled).toBe(true)
    expect(classOf(el)).toContain('disabled:opacity-50')
  })
})

describe('ImageTile', () => {
  it('names the photo and marks the current one with a teal border', () => {
    const on = ImageTile({
      src: 'a.jpg',
      selected: true,
      onClick: () => {},
      'aria-label': 'Photo 1 of 2',
    })
    expect(propsOf(on)['aria-label']).toBe('Photo 1 of 2')
    expect(propsOf(on)['aria-current']).toBe(true)
    expect(classOf(on)).toContain('border-lob-teal')
    const off = ImageTile({
      src: 'b.jpg',
      selected: false,
      onClick: () => {},
      'aria-label': 'Photo 2 of 2',
    })
    expect(propsOf(off)['aria-current']).toBeUndefined()
    expect(classOf(off)).toContain('opacity-60')
  })
})
