import { describe, expect, it } from 'vitest'
import { ActionRow } from './ActionRow'
import { propsOf } from '../../test/element'

describe('ActionRow', () => {
  it('lays its buttons out at equal width with a fixed gap', () => {
    const el = ActionRow({ children: 'BUTTONS' })
    expect(propsOf(el).className).toBe('flex gap-2 [&>*]:flex-1')
    expect(propsOf(el).children).toBe('BUTTONS')
  })

  it('keeps natural widths at the end of the row', () => {
    const el = ActionRow({ children: 'BUTTONS', layout: 'end' })
    expect(propsOf(el).className).toBe('flex items-center justify-end gap-2')
  })
})
