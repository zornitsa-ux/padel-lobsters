import { describe, expect, it } from 'vitest'
import { safeAppPath } from './safePath'

const origin = 'https://padel.example'
const check = (input: string | null | undefined) => safeAppPath({ input, origin })

describe('safeAppPath', () => {
  it.each([
    ['/home', '/home'],
    ['/events/7/join?signup=1&src=ig#top', '/events/7/join?signup=1&src=ig#top'],
    [`${origin}/events/7`, '/events/7'],
    ['/events/../community', '/community'],
  ])('keeps %j as %j', (input, expected) => {
    expect(check(input)).toBe(expected)
  })

  it.each([
    '//evil.example',
    '//evil.example/home',
    '/\\evil.example',
    '\\\\evil.example',
    '/\t/evil.example',
    ' //evil.example',
    'https://evil.example/home',
    'https://padel.example.evil.example/home',
    'https://padel.example@evil.example/home',
    'http://padel.example/home',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '',
    null,
    undefined,
  ])('rejects %j', (input) => {
    expect(check(input)).toBeNull()
  })
})
