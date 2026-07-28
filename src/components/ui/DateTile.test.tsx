import { describe, expect, it } from 'vitest'
import DateTile from './DateTile'
import { childrenOf, propsOf } from '../../test/element'

// The tile is [month banner, [day, dow]].
const parts = (el: unknown) => {
  const [month, body] = childrenOf(el)
  const [day, dow] = childrenOf(body)
  return { month, day, dow }
}

describe('DateTile', () => {
  it('renders nothing without a date', () => {
    expect(DateTile({ date: undefined })).toBeNull()
    expect(DateTile({ date: null })).toBeNull()
    expect(DateTile({ date: '' })).toBeNull()
  })

  it('renders nothing for an unparseable date', () => {
    expect(DateTile({ date: 'not-a-date' })).toBeNull()
  })

  it('renders month, day and weekday in en-GB caps', () => {
    const { month, day, dow } = parts(DateTile({ date: '2026-06-01' }))
    expect(propsOf(month).children).toBe('JUN')
    expect(propsOf(day).children).toBe(1)
    expect(propsOf(dow).children).toBe('MON')
  })

  it.each([
    ['sm', 'w-11 h-12', 'text-lg'],
    ['md', 'w-14 h-16', 'text-2xl'],
    ['lg', 'w-16 h-20', 'text-3xl'],
  ] as const)('sizes the box and day text for %s', (size, box, dayClass) => {
    const el = DateTile({ date: '2026-06-01', size })
    expect(String(propsOf(el).className)).toContain(box)
    expect(String(propsOf(parts(el).day).className)).toContain(dayClass)
  })

  it('defaults to the md dimensions', () => {
    const el = DateTile({ date: '2026-06-01' })
    expect(String(propsOf(el).className)).toContain('w-14 h-16')
  })

  it('appends className to the wrapper', () => {
    const el = DateTile({ date: '2026-06-01', className: 'grayscale' })
    expect(String(propsOf(el).className).endsWith('grayscale')).toBe(true)
  })
})
