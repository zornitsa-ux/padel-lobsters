// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installChunkReload, shouldReload } from './chunkReload'

describe('shouldReload', () => {
  it('reloads when there has been no reload this session', () => {
    expect(shouldReload({ lastReloadAt: null, now: 50_000 })).toBe(true)
  })

  it('does not reload again within ten seconds', () => {
    expect(shouldReload({ lastReloadAt: '45000', now: 50_000 })).toBe(false)
  })

  it('reloads again after ten seconds', () => {
    expect(shouldReload({ lastReloadAt: '30000', now: 50_000 })).toBe(true)
  })
})

describe('installChunkReload', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  const fakeWindow = () => {
    const target = new EventTarget()
    const reload = vi.fn()
    const win = Object.assign(target, { location: { reload } }) as unknown as Window
    installChunkReload({ win })
    return { win, reload }
  }

  const preloadError = () => new Event('vite:preloadError', { cancelable: true })

  it('reloads once and cancels the error', () => {
    const { win, reload } = fakeWindow()
    const event = preloadError()
    win.dispatchEvent(event)
    expect(reload).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('lets a second failure through instead of looping', () => {
    const { win, reload } = fakeWindow()
    win.dispatchEvent(preloadError())
    const second = preloadError()
    win.dispatchEvent(second)
    expect(reload).toHaveBeenCalledOnce()
    expect(second.defaultPrevented).toBe(false)
  })
})
