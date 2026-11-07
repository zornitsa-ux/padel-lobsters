// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  forgetSharePlacement,
  keepShareTags,
  readStoredSharePlacement,
  rememberSharePlacement,
  sharePlacementFrom,
  withShareTags,
} from './shareTags'

const tagged = '?utm_source=share&utm_content=home'

afterEach(() => window.sessionStorage.clear())

describe('sharePlacementFrom', () => {
  it('reads a known placement from our share tags', () => {
    expect(sharePlacementFrom({ search: tagged })).toBe('home')
  })

  it('ignores other sources, unknown placements and missing tags', () => {
    expect(sharePlacementFrom({ search: '?utm_source=newsletter&utm_content=home' })).toBeNull()
    expect(sharePlacementFrom({ search: '?utm_source=share&utm_content=<script>' })).toBeNull()
    expect(sharePlacementFrom({ search: '?utm_source=share' })).toBeNull()
    expect(sharePlacementFrom({ search: '' })).toBeNull()
  })
})

describe('keepShareTags', () => {
  it('keeps only the share tags', () => {
    expect(keepShareTags({ search: `?signup=1&email=a%40b.nl&${tagged.slice(1)}&x=1` })).toBe(
      tagged,
    )
    expect(keepShareTags({ search: '?signup=1' })).toBe('')
  })
})

describe('withShareTags', () => {
  it('appends the tags to a path with or without a query', () => {
    expect(withShareTags({ path: '../info', search: tagged })).toBe(`../info${tagged}`)
    expect(withShareTags({ path: '/events/1/join?signup=1', search: tagged })).toBe(
      `/events/1/join?signup=1&${tagged.slice(1)}`,
    )
  })

  it('leaves the path alone without tags', () => {
    expect(withShareTags({ path: '../info', search: '?signup=1' })).toBe('../info')
  })
})

describe('remembered placement', () => {
  it('keeps the first placement for this tab, until forgotten', () => {
    rememberSharePlacement({ search: tagged })
    rememberSharePlacement({ search: '?utm_source=share&utm_content=you-tab' })
    expect(readStoredSharePlacement()).toBe('home')
    forgetSharePlacement()
    expect(readStoredSharePlacement()).toBeNull()
  })

  it('ignores a tampered stored value', () => {
    window.sessionStorage.setItem('pl_share_placement', 'evil')
    expect(readStoredSharePlacement()).toBeNull()
  })
})
