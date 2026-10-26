import { describe, expect, it, vi } from 'vitest'
import { Link } from 'react-router-dom'
import { Button } from './Button'
import { propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('Button', () => {
  it('defaults to a primary md button of type button', () => {
    const el = Button({ children: 'Save' })
    expect(propsOf(el).type).toBe('button')
    expect(classOf(el)).toContain('bg-lob-coral text-white')
    expect(classOf(el)).toContain('py-2 px-4 text-sm')
    expect(classOf(el)).toContain('disabled:opacity-50')
    expect(classOf(el)).toContain('not-disabled:hover:shadow-xl')
    expect(classOf(el)).not.toMatch(/(^| )hover:/)
  })

  it('applies the secondary and danger variants', () => {
    expect(classOf(Button({ children: 'Cancel', variant: 'secondary' }))).toContain(
      'bg-white text-lob-teal border-lob-teal',
    )
    expect(classOf(Button({ children: 'Delete', variant: 'danger' }))).toContain(
      'bg-lob-danger-solid',
    )
  })

  it('supports the sm and lg sizes', () => {
    expect(classOf(Button({ children: 'Go', size: 'sm' }))).toContain('py-1.5 px-3 text-xs')
    expect(classOf(Button({ children: 'Go', size: 'lg' }))).toContain('py-3 px-5')
  })

  it('keeps a submit type and forwards button attributes', () => {
    const onClick = vi.fn()
    const el = Button({ children: 'Send', type: 'submit', form: 'f', disabled: true, onClick })
    expect(propsOf(el).type).toBe('submit')
    expect(propsOf(el).form).toBe('f')
    expect(propsOf(el).disabled).toBe(true)
    expect(propsOf(el).onClick).toBe(onClick)
  })

  it('sizes the icon to the button', () => {
    expect(classOf(Button({ children: 'Go', size: 'sm' }))).toContain('[&>svg]:size-3.5')
    expect(classOf(Button({ children: 'Go' }))).toContain('[&>svg]:size-4')
  })

  it('renders the icon before the label', () => {
    const el = Button({ children: 'Add', icon: 'ICON' })
    expect(propsOf(propsOf(el).children).children).toEqual(['ICON', 'Add'])
  })

  it('never shrinks unless it fills its container', () => {
    expect(classOf(Button({ children: 'Go' }))).toContain('shrink-0')
    const full = classOf(Button({ children: 'Go', fullWidth: true }))
    expect(full).toContain('w-full')
    expect(full).not.toMatch(/(^| )shrink-0/)
  })
  it('renders a router Link for `to`', () => {
    const el = Button({ children: 'Open', to: '/events' })
    expect((el as { type: unknown }).type).toBe(Link)
    expect(propsOf(el).to).toBe('/events')
    expect(classOf(el)).toContain('bg-lob-coral')
  })

  it('renders an anchor for `href`, in a new tab when external', () => {
    const same = Button({ children: 'Mail', href: 'mailto:a@b.nl' })
    expect((same as { type: unknown }).type).toBe('a')
    expect(propsOf(same).target).toBeUndefined()

    const external = Button({ children: 'Open', href: 'https://x.nl', external: true })
    expect(propsOf(external).target).toBe('_blank')
    expect(propsOf(external).rel).toBe('noopener noreferrer')
    expect(propsOf(external).external).toBeUndefined()
  })

  it('renders a disabled link as a disabled button so it cannot navigate', () => {
    const el = Button({
      children: 'Open',
      href: 'https://x.nl',
      external: true,
      target: '_self',
      download: 'file',
      disabled: true,
      title: 'Open it',
    })
    expect((el as { type: unknown }).type).toBe('button')
    expect(propsOf(el).disabled).toBe(true)
    expect(propsOf(el).href).toBeUndefined()
    // Anchor-only attributes don't leak onto the button; shared ones survive.
    expect(propsOf(el).target).toBeUndefined()
    expect(propsOf(el).download).toBeUndefined()
    expect(propsOf(el).title).toBe('Open it')
  })
})
