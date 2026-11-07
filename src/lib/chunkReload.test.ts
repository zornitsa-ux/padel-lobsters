// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Fresh module per test: the "reload started" flag is module state.
const load = async () => {
  vi.resetModules()
  return import('./chunkReload')
}

const memoryStorage = (): Storage => {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size
    },
  }
}

// Like Safari with storage blocked: writes are dropped.
const droppingStorage = (): Storage => ({ ...memoryStorage(), setItem: () => {} })

const fakeWindow = () => {
  const reload = vi.fn()
  const win = Object.assign(new EventTarget(), { location: { reload } }) as unknown as Window
  return { win, reload }
}

const preloadError = (
  message = 'Failed to fetch dynamically imported module: /assets/Players-a1.js',
) =>
  Object.assign(new Event('vite:preloadError', { cancelable: true }), {
    payload: new Error(message),
  })

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('installChunkReload', () => {
  it('reloads once and cancels the error', async () => {
    const { installChunkReload, isChunkReloading } = await load()
    const { win, reload } = fakeWindow()
    installChunkReload({ win, storage: memoryStorage() })
    const event = preloadError()
    win.dispatchEvent(event)
    expect(reload).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
    expect(isChunkReloading()).toBe(true)
  })

  it('lets a failure after the reload through, however long it took', async () => {
    const storage = memoryStorage()
    const first = await load()
    const before = fakeWindow()
    first.installChunkReload({ win: before.win, storage })
    before.win.dispatchEvent(preloadError())
    expect(before.reload).toHaveBeenCalledOnce()

    const second = await load()
    const { win, reload } = fakeWindow()
    second.installChunkReload({ win, storage })
    vi.advanceTimersByTime(30_000)
    const event = preloadError()
    win.dispatchEvent(event)
    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('reloads again once the app has run cleanly for a minute', async () => {
    const storage = memoryStorage()
    storage.setItem('chunk-reload-pending', '1')
    const { installChunkReload } = await load()
    const { win, reload } = fakeWindow()
    installChunkReload({ win, storage })
    vi.advanceTimersByTime(60_000)
    win.dispatchEvent(preloadError())
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload when the marker cannot be stored', async () => {
    const { installChunkReload } = await load()
    const { win, reload } = fakeWindow()
    installChunkReload({ win, storage: droppingStorage() })
    const event = preloadError()
    win.dispatchEvent(event)
    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does not reload without storage at all', async () => {
    const { installChunkReload } = await load()
    const { win, reload } = fakeWindow()
    installChunkReload({ win, storage: null })
    win.dispatchEvent(preloadError())
    expect(reload).not.toHaveBeenCalled()
  })

  it('skips optional chunks such as analytics', async () => {
    const { installChunkReload } = await load()
    const { win, reload } = fakeWindow()
    installChunkReload({ win, storage: memoryStorage() })
    const event = preloadError(
      'Failed to fetch dynamically imported module: /assets/GuestAnalytics-x9.js',
    )
    win.dispatchEvent(event)
    expect(reload).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('cancels further failures while the reload is under way', async () => {
    const { installChunkReload } = await load()
    const { win, reload } = fakeWindow()
    installChunkReload({ win, storage: memoryStorage() })
    win.dispatchEvent(preloadError())
    const later = preloadError()
    win.dispatchEvent(later)
    expect(reload).toHaveBeenCalledOnce()
    expect(later.defaultPrevented).toBe(true)
  })
})
