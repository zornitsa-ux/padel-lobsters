import { describe, expect, it, vi } from 'vitest'
import { emitToast, subscribeToast } from './toastBus'

describe('toastBus', () => {
  it('delivers an emitted event to a subscribed listener', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToast(listener)

    emitToast({ variant: 'error', message: 'boom' })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ variant: 'error', message: 'boom' })
    unsubscribe()
  })

  it('stops delivering events once unsubscribed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToast(listener)
    unsubscribe()

    emitToast({ variant: 'success', message: 'saved' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('supports multiple independent subscribers', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = subscribeToast(a)
    const unsubB = subscribeToast(b)

    emitToast({ variant: 'success', message: 'hi' })

    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
    unsubA()
    unsubB()
  })
})
