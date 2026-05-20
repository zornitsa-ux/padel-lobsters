import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDeviceId, getDeviceId, getUserAgentSummary } from './deviceId'

describe('deviceId helpers', () => {
  beforeEach(() => {
    let store: Record<string, string> = {}
    const localStorageMock = {
      getItem: vi.fn((k: string) => store[k] ?? null),
      setItem: vi.fn((k: string, v: string) => {
        store[k] = v
      }),
      removeItem: vi.fn((k: string) => {
        delete store[k]
      }),
    }

    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })

    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'PadelLobstersTestUA' },
      configurable: true,
    })
  })

  it('creates and persists a device id once', () => {
    const first = getDeviceId()
    const second = getDeviceId()

    expect(first).toBeTypeOf('string')
    expect(first).toBe(second)
    expect(localStorage.setItem).toHaveBeenCalledTimes(1)
  })

  it('clears persisted device id', () => {
    getDeviceId()
    clearDeviceId()
    expect(localStorage.removeItem).toHaveBeenCalledWith('lobster_device_id')
  })

  it('returns a user-agent summary', () => {
    expect(getUserAgentSummary()).toBe('PadelLobstersTestUA')
  })
})
