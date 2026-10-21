// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { isSafeReturnPath, saveReturnPath, takeReturnPath } from './returnPath'

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
})
