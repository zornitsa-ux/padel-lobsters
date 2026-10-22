import { describe, expect, it } from 'vitest'
import {
  EMPTY_DRAFT,
  choiceToDraft,
  draftToChoice,
  isDraftComplete,
  isLevelValid,
} from './teamHelpers'

describe('new partner draft', () => {
  const filled = { ...EMPTY_DRAFT, name: 'A', email: 'a@test.invalid', consent: true }

  it('needs consent, name and email', () => {
    expect(isDraftComplete({ draft: filled })).toBe(true)
    expect(isDraftComplete({ draft: { ...filled, consent: false } })).toBe(false)
  })

  it('accepts an empty or 0–7 level, with a comma decimal', () => {
    expect(isLevelValid({ level: '' })).toBe(true)
    expect(isLevelValid({ level: '3,5' })).toBe(true)
    expect(isLevelValid({ level: 'abc' })).toBe(false)
    expect(isLevelValid({ level: '9' })).toBe(false)
    expect(isDraftComplete({ draft: { ...filled, level: 'abc' } })).toBe(false)
  })
})

describe('choiceToDraft', () => {
  it('round-trips a new partner so Back keeps what was typed', () => {
    const draft = { name: 'A', email: 'a@test.invalid', level: '3.5', consent: true }
    expect(choiceToDraft({ choice: draftToChoice({ draft }) })).toEqual(draft)
  })

  it('starts empty for a member or no choice', () => {
    expect(choiceToDraft({ choice: { kind: 'member', playerId: 'p1' } })).toEqual(EMPTY_DRAFT)
    expect(choiceToDraft({ choice: null })).toEqual(EMPTY_DRAFT)
  })
})
