import { describe, expect, it } from 'vitest'
import DEFAULT_TIPS from './padelTips'

describe('padel tips defaults', () => {
  it('contains the expected fixed tip set', () => {
    expect(DEFAULT_TIPS).toHaveLength(50)
    expect(DEFAULT_TIPS[0]).toContain('Always return to the center')
  })

  it('contains non-empty string tips', () => {
    expect(DEFAULT_TIPS.every((tip) => typeof tip === 'string' && tip.trim().length > 0)).toBe(true)
  })
})
