import { describe, expect, it, vi } from 'vitest'
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

  it('renders the icon before the label and appends layout classes', () => {
    const el = Button({ children: 'Add', icon: 'ICON', className: 'w-full' })
    expect(propsOf(el).children).toEqual(['ICON', 'Add'])
    expect(classOf(el).endsWith('w-full')).toBe(true)
  })
})
