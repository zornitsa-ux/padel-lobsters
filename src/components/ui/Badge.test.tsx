import { describe, expect, it } from 'vitest'
import { Badge, BADGE_TONES } from './Badge'
import { propsOf } from '../../test/element'

const classOf = (el: unknown) => String(propsOf(el).className)

describe('Badge', () => {
  it('is one size of pill for every tone', () => {
    BADGE_TONES.forEach((tone) =>
      expect(classOf(Badge({ tone, label: 'x' }))).toContain(
        'rounded-full px-2 py-0.5 text-xs font-semibold',
      ),
    )
  })

  it('takes its colours from the tone', () => {
    expect(classOf(Badge({ tone: 'success', label: 'Paid' }))).toContain(
      'bg-lob-success-soft text-lob-success',
    )
    expect(classOf(Badge({ tone: 'danger', label: 'Unpaid' }))).toContain(
      'bg-lob-danger-soft text-lob-danger',
    )
    expect(classOf(Badge({ tone: 'outline', label: 'Tied' }))).toContain('ring-lob-line-strong')
    expect(classOf(Badge({ tone: 'accent', label: 'Draft' }))).toContain(
      'bg-lob-amber/15 text-lob-amber-strong',
    )
  })

  it('sizes its icon and keeps it before the label', () => {
    const el = Badge({ tone: 'brand', label: 'Live', icon: 'i' })
    expect(classOf(el)).toContain('[&>svg]:size-3')
    const [icon, label] = propsOf(el).children as unknown[]
    expect(icon).toBe('i')
    expect(propsOf(label).children).toBe('Live')
  })

  it('truncates a long label instead of overflowing its row', () => {
    const el = Badge({ tone: 'success', label: 'Paid by a very long name' })
    expect(classOf(el)).toContain('min-w-0 max-w-full')
    expect(classOf((propsOf(el).children as unknown[])[1])).toBe('truncate')
  })

  it('passes a tooltip through', () => {
    expect(
      propsOf(Badge({ tone: 'info', label: 'Paid', title: 'Player says they paid' })).title,
    ).toBe('Player says they paid')
  })
})
