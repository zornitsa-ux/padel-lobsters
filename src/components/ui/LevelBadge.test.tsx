import { describe, it, expect } from 'vitest'
import { LevelBadge } from './LevelBadge'
import { propsOf } from '../../test/element'

const levelBand = ({ level }: { level: number | null }) =>
  String(propsOf(LevelBadge({ level })).className)

describe('LevelBadge bands', () => {
  it('bands levels into a teal ramp: under 2, 2 to 3.9, 4 to 4.9, 5 and up', () => {
    expect(levelBand({ level: 1.9 })).toContain('bg-lob-line-strong')
    expect(levelBand({ level: 2 })).toContain('bg-lob-teal-light')
    expect(levelBand({ level: 3.99 })).toContain('bg-lob-teal-light')
    expect(levelBand({ level: 4 })).toContain('ring-lob-teal')
    expect(levelBand({ level: 5 })).toContain('bg-lob-teal text-white')
    expect(levelBand({ level: 7 })).toContain('bg-lob-teal text-white')
  })
})

describe('LevelBadge', () => {
  it('shows the level to one decimal', () => {
    expect(propsOf(LevelBadge({ level: 3.45 })).children).toBe('3.5')
  })

  it('shows nothing for a player with no level', () => {
    expect(LevelBadge({ level: 0 })).toBeNull()
    expect(LevelBadge({ level: null })).toBeNull()
    expect(LevelBadge({ level: Number.NaN })).toBeNull()
  })

  it('has a smaller size for a line of text', () => {
    expect(String(propsOf(LevelBadge({ level: 3, size: 'sm' })).className)).toContain('text-xs')
  })
})
