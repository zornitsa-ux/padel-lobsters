import { describe, expect, it } from 'vitest'
import levelCases from '../../supabase/tests/level_cases.json'
import {
  formatLevel,
  givenLevel,
  hasLevel,
  INVALID_LEVEL_MESSAGE,
  knownLevel,
  LEVEL_REQUIRED_MESSAGE,
  LevelRefusal,
  levelFieldValue,
  levelOrNoLevelStart,
  levelOutcome,
  levelPolicy,
  levelProblem,
  levelRefusalMessage,
  levelText,
  parseLevel,
  typedLevel,
  typedLevelProblem,
  withLevelMessage,
  type LevelPolicy,
} from './level'

describe('levelRefusalMessage', () => {
  it('puts the database level refusals into words (C-8)', () => {
    expect(levelRefusalMessage({ error: { code: 'P0001', message: 'invalid_level' } })).toBe(
      INVALID_LEVEL_MESSAGE,
    )
    expect(levelRefusalMessage({ error: { code: 'P0001', message: 'level_required' } })).toBe(
      LEVEL_REQUIRED_MESSAGE,
    )
  })

  it('leaves other errors alone', () => {
    expect(levelRefusalMessage({ error: { code: 'P0001', message: 'needs_level' } })).toBeNull()
    expect(levelRefusalMessage({ error: { code: '23505', message: 'invalid_level' } })).toBeNull()
    expect(levelRefusalMessage({ error: new Error('offline') })).toBeNull()
  })
})

describe('withLevelMessage', () => {
  it('turns a level refusal into an Error with the message', () => {
    const shown = withLevelMessage({ error: { code: 'P0001', message: 'level_required' } })
    expect(shown).toBeInstanceOf(LevelRefusal)
    expect((shown as Error).message).toBe(LEVEL_REQUIRED_MESSAGE)
  })

  it('passes anything else through unchanged', () => {
    const error = { code: '42501', message: 'permission denied' }
    expect(withLevelMessage({ error })).toBe(error)
  })
})

describe('knownLevel and hasLevel', () => {
  it('keep only a level above 0', () => {
    expect(knownLevel({ level: 0.5 })).toBe(0.5)
    expect(knownLevel({ level: 0 })).toBeNull()
    expect(knownLevel({ level: Number.NaN })).toBeNull()
    expect(hasLevel({ level: 2 })).toBe(true)
    expect(hasLevel({ level: null })).toBe(false)
    expect(hasLevel({ level: undefined })).toBe(false)
  })
})

describe('levelOrNoLevelStart', () => {
  it('falls back to 1 for no level (D-15)', () => {
    expect(levelOrNoLevelStart({ level: 3.5 })).toBe(3.5)
    expect(levelOrNoLevelStart({ level: 0 })).toBe(1)
  })
})

describe('levelText and formatLevel', () => {
  it('shows a level as written, never rounded, and leaves no level out', () => {
    expect(levelText({ level: 2.45 })).toBe('Lv 2.45')
    expect(levelText({ level: 3, prefix: 'Level' })).toBe('Level 3.0')
    expect(levelText({ level: 0 })).toBeUndefined()
    expect(formatLevel({ level: 0.3 })).toBe('0.3')
    expect(formatLevel({ level: 0.01 })).toBe('0.01')
    expect(formatLevel({ level: 6.99 })).toBe('6.99')
  })
})

describe('levelFieldValue', () => {
  it('starts a field with the level, or empty for none', () => {
    expect(levelFieldValue({ level: 2.45 })).toBe('2.45')
    expect(levelFieldValue({ level: 0 })).toBe('')
    expect(levelFieldValue({ level: null })).toBe('')
  })
})

// The same table supabase/tests/level.sh runs through private.parse_level and
// private.level_to_store, so the client and the database can't disagree.
describe('level_cases.json', () => {
  const policies: LevelPolicy[] = ['required', 'optional', 'keep']

  it.each(levelCases.cases)('parses "$input"', (c) => {
    expect(parseLevel({ value: c.input })).toBe(c.level)
  })

  it.each(levelCases.cases)('gives each policy its outcome for "$input"', (c) => {
    for (const policy of policies) {
      expect(levelOutcome({ value: c.input, policy })).toBe(c[policy])
    }
  })

  it.each(levelCases.cases)('refuses "$input" only where the table does', (c) => {
    for (const policy of policies) {
      const refused = c[policy] === 'blank' || c[policy] === 'invalid'
      expect(levelProblem({ value: c.input, policy }) !== '').toBe(refused)
    }
  })
})

describe('levelProblem', () => {
  it('says what is wrong in the words the server refusals use', () => {
    expect(levelProblem({ value: '2.455', policy: 'optional' })).toBe(INVALID_LEVEL_MESSAGE)
    expect(levelProblem({ value: '', policy: 'required' })).toBe(INVALID_LEVEL_MESSAGE)
    expect(levelProblem({ value: '0', policy: 'keep' })).toBe(LEVEL_REQUIRED_MESSAGE)
    expect(levelProblem({ value: '', policy: 'optional' })).toBe('')
  })

  it('waits quietly while a field is empty', () => {
    expect(typedLevelProblem({ value: ' ', policy: 'required' })).toBe('')
    expect(typedLevelProblem({ value: '0', policy: 'required' })).toBe(INVALID_LEVEL_MESSAGE)
  })
})

describe('levelPolicy', () => {
  it('keeps a recorded level and leaves none optional', () => {
    expect(levelPolicy({ recorded: 2.5 })).toBe('keep')
    expect(levelPolicy({ recorded: 0 })).toBe('optional')
    expect(levelPolicy({ recorded: undefined })).toBe('optional')
  })
})

describe('givenLevel', () => {
  it('is the level when one is typed, else null', () => {
    expect(givenLevel({ value: '2,45' })).toBe(2.45)
    expect(givenLevel({ value: '0' })).toBeNull()
    expect(givenLevel({ value: '8' })).toBeNull()
  })
})

describe('typedLevel', () => {
  it('sends the text as typed and never "null"', () => {
    expect(typedLevel({ value: '2,5' })).toBe('2,5')
    expect(typedLevel({ value: ' 2.5\u00a0' })).toBe('2.5')
    expect(typedLevel({ value: 3.25 })).toBe('3.25')
    expect(typedLevel({ value: null })).toBe('')
    expect(typedLevel({ value: undefined })).toBe('')
  })
})
