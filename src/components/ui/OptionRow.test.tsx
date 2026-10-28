import { describe, expect, it, vi } from 'vitest'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { OptionRow } from './OptionRow'
import { childrenOf, propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)
const targetOf = (el: unknown) => childrenOf(el)[0]
const contentOf = (el: unknown) => childrenOf(propsOf(targetOf(el)).children)

describe('OptionRow', () => {
  it('is a well-tinted row whose button acts straight away', () => {
    const onClick = vi.fn()
    const el = OptionRow({ title: 'Ana', onClick })
    expect(classOf(el)).toContain('bg-lob-well border-lob-line hover:border-lob-teal')
    const target = targetOf(el)
    expect(target.type).toBe('button')
    expect(propsOf(target).onClick).toBe(onClick)
    expect(propsOf(target)['aria-pressed']).toBeUndefined()
  })

  it('tints teal with a check and sets aria-pressed when selected', () => {
    const el = OptionRow({ title: 'Ana', selected: true, onClick: () => {} })
    expect(classOf(el)).toContain('bg-lob-teal-light border-lob-teal')
    expect(propsOf(targetOf(el))['aria-pressed']).toBe(true)
    const check = contentOf(el).at(-1) as { type: unknown }
    expect(check.type).toBe(Check)
  })

  it('reports aria-pressed false for an unselected option', () => {
    const el = OptionRow({ title: 'Ana', selected: false, onClick: () => {} })
    expect(propsOf(targetOf(el))['aria-pressed']).toBe(false)
    expect(contentOf(el).at(-1)).toBe(false)
  })

  it('keeps actions outside the tap target', () => {
    const el = OptionRow({ title: 'Ana', onClick: () => {}, actions: 'REVEAL' })
    const [, actions] = childrenOf(el)
    expect(propsOf(actions).children).toBe('REVEAL')
  })

  it('dims and drops the hover when disabled', () => {
    const el = OptionRow({ title: 'Ana', onClick: () => {}, disabled: true })
    expect(classOf(el)).toContain('opacity-50')
    expect(classOf(el)).not.toContain('hover:')
    expect(propsOf(targetOf(el)).disabled).toBe(true)
  })

  it('renders a router link for `to`', () => {
    expect(targetOf(OptionRow({ title: 'Payments', to: '/admin' })).type).toBe(Link)
  })
})
