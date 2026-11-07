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

  it('leaves out the sign-in deep link params, keeping the rest', () => {
    window.history.replaceState({}, '', '/community?signin=1&email=a%40b.test&tab=shop#top')
    saveReturnPath()

    expect(takeReturnPath()).toBe('/community?tab=shop#top')
    expect(emailReturnUrl()).toBe(`${window.location.origin}/community?tab=shop`)
  })

  it('gives the email the current page without its hash', () => {
    window.history.replaceState({}, '', '/events/7/join?signup=1#top')
    expect(emailReturnUrl()).toBe(`${window.location.origin}/events/7/join?signup=1`)
  })
})

describe('returnPathFromUrl', () => {
  it('keeps only the path and query', () => {
    expect(returnPathFromUrl({ url: 'https://padel.example/events/7/join?signup=1&src=ig' })).toBe(
      '/events/7/join?signup=1&src=ig',
    )
  })

  it('keeps the path of another origin too: navigation never leaves the app', () => {
    expect(returnPathFromUrl({ url: 'https://www.padel.example/events/7' })).toBe('/events/7')
  })

  it.each([
    ['the bare site URL', 'https://padel.example'],
    ['the site URL with a slash', 'https://padel.example/'],
    ['an auth page', 'https://padel.example/auth/confirm?next=/home'],
    ['a path, not a URL', '/events/7'],
    ['a protocol-relative path', 'https://padel.example//evil.example/x'],
    ['a backslash path', 'https://padel.example/\\evil.example/x'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['nothing', null],
  ])('ignores %s', (_label, url) => {
    expect(returnPathFromUrl({ url })).toBeNull()
  })
})
