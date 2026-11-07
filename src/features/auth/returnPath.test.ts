// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  emailReturnUrl,
  isSafeReturnPath,
  returnPathFromUrl,
  saveReturnPath,
  takeReturnPath,
} from './returnPath'

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState({}, '', '/')
})

describe('returnPath', () => {
  it('stores pathname, search and hash, then clears on take', () => {
    window.history.replaceState({}, '', '/transfer/42?from=wa#top')
    saveReturnPath()

    expect(window.localStorage.getItem('pl_auth_return_path')).toBe('/transfer/42?from=wa#top')
    expect(takeReturnPath()).toBe('/transfer/42?from=wa#top')
    expect(takeReturnPath()).toBeNull()
  })

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'home', ''])(
    'discards %j',
    (value) => {
      window.localStorage.setItem('pl_auth_return_path', value)
      expect(takeReturnPath()).toBeNull()
      expect(window.localStorage.getItem('pl_auth_return_path')).toBeNull()
    },
  )

  it('validates next params the same way', () => {
    expect(isSafeReturnPath('/home')).toBe(true)
    expect(isSafeReturnPath('//x')).toBe(false)
    expect(isSafeReturnPath(null)).toBe(false)
  })

  it('gives the email the current page without its hash', () => {
    window.history.replaceState({}, '', '/events/7/join?signup=1#top')
    expect(emailReturnUrl()).toBe(`${window.location.origin}/events/7/join?signup=1`)
  })
})

describe('returnPathFromUrl', () => {
  const origin = 'https://padel.example'

  it('turns a same-origin URL into a path', () => {
    expect(returnPathFromUrl({ url: `${origin}/events/7/join?signup=1`, origin })).toBe(
      '/events/7/join?signup=1',
    )
  })

  it.each([
    ['another origin', 'https://evil.example/events/7'],
    ['the bare site URL', origin],
    ['the site URL with a slash', `${origin}/`],
    ['an auth page', `${origin}/auth/confirm?next=/home`],
    ['a path, not a URL', '/events/7'],
    ['nothing', null],
  ])('ignores %s', (_label, url) => {
    expect(returnPathFromUrl({ url, origin })).toBeNull()
  })
})
