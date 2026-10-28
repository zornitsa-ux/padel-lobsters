import { describe, expect, it } from 'vitest'
import { onBehalfMessage } from './confirmOnBehalf'

describe('onBehalfMessage', () => {
  it('lists the facts then asks for a check', () => {
    expect(onBehalfMessage({ lines: ['Captain: Alma', 'Partner: Bob'] })).toBe(
      'Captain: Alma\nPartner: Bob\n\nCheck this is the right person before you continue.',
    )
  })
})

describe('onBehalfMessage footer', () => {
  it('takes a per-action footer', () => {
    expect(onBehalfMessage({ lines: ['Mark Alma as paid'], footer: 'Check the amount.' })).toBe(
      'Mark Alma as paid\n\nCheck the amount.',
    )
  })
})
