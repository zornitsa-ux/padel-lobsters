import { describe, it, expect, vi, afterEach } from 'vitest'
import { supabase } from '../../supabase'
import { subscribeTournament, broadcastScore, broadcastSchedule } from './tournamentChannel'

// vi.hoisted runs before vi.mock hoisting, making these available inside the factory.
const { mockChannel, mockRemoveChannel } = vi.hoisted(() => {
  const ch = {
    on: vi.fn(),
    subscribe: vi.fn(),
    send: vi.fn(),
  }
  // Make the builder chain return itself so .channel(...).on(...).subscribe() works.
  ch.on.mockReturnValue(ch)
  ch.subscribe.mockReturnValue(ch)
  return { mockChannel: ch, mockRemoveChannel: vi.fn() }
})

vi.mock('../../supabase', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  },
}))

// Track unsubs that need cleanup so tests stay independent.
const pendingUnsubs: Array<() => void> = []

afterEach(() => {
  // Drain any open subscriptions to clear the module-level channels Map.
  while (pendingUnsubs.length) pendingUnsubs.pop()!()
  vi.clearAllMocks()
  // Re-establish chain after clearing (clearAllMocks wipes call history but
  // leaves mockReturnValue intact, so this is defensive).
  mockChannel.on.mockReturnValue(mockChannel)
  mockChannel.subscribe.mockReturnValue(mockChannel)
})

// ---------------------------------------------------------------------------
// subscribeTournament
// ---------------------------------------------------------------------------

describe('subscribeTournament', () => {
  it('creates one channel per tournamentId and reuses it for a second subscriber', () => {
    const unsub1 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    const unsub2 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    pendingUnsubs.push(unsub1, unsub2)

    expect(vi.mocked(supabase.channel)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(supabase.channel)).toHaveBeenCalledWith('scores:t1', expect.anything())
  })

  it('creates separate channels for distinct tournamentIds', () => {
    const unsub1 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    const unsub2 = subscribeTournament({ tournamentId: 't2', onScore: vi.fn() })
    pendingUnsubs.push(unsub1, unsub2)

    expect(vi.mocked(supabase.channel)).toHaveBeenCalledTimes(2)
  })

  it('invokes all registered onScore listeners with the incoming payload', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const unsub1 = subscribeTournament({ tournamentId: 't1', onScore: fn1 })
    const unsub2 = subscribeTournament({ tournamentId: 't1', onScore: fn2 })
    pendingUnsubs.push(unsub1, unsub2)

    // The broadcast handler is registered as the third arg of the first .on() call.
    const handler = mockChannel.on.mock.calls[0][2] as (msg: { payload: unknown }) => void
    handler({ payload: { id: 'm1', score1: 3, score2: 1 } })

    expect(fn1).toHaveBeenCalledOnce()
    expect(fn1).toHaveBeenCalledWith({ id: 'm1', score1: 3, score2: 1 })
    expect(fn2).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledWith({ id: 'm1', score1: 3, score2: 1 })
  })

  it('creates the channel with config.broadcast.self === false', () => {
    const unsub = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    pendingUnsubs.push(unsub)

    expect(vi.mocked(supabase.channel)).toHaveBeenCalledWith('scores:t1', {
      config: { broadcast: { self: false } },
    })
  })

  it('does not tear down the channel while a subscriber is still active', () => {
    const unsub1 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    const unsub2 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    // Only track unsub2 for afterEach; we call unsub1 ourselves below.
    pendingUnsubs.push(unsub2)

    unsub1() // refCount: 2 → 1
    expect(mockRemoveChannel).not.toHaveBeenCalled()
  })

  it('tears down the channel when the last subscriber unsubscribes', () => {
    const unsub1 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    const unsub2 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })

    unsub1() // refCount 2 → 1
    expect(mockRemoveChannel).not.toHaveBeenCalled()

    unsub2() // refCount 1 → 0 → removed
    expect(mockRemoveChannel).toHaveBeenCalledOnce()
    expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel)
    // Both called explicitly; nothing pushed to pendingUnsubs.
  })

  it('creates a fresh channel after the previous one was torn down', () => {
    const unsub1 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    unsub1() // teardown → removed from Map

    const unsub2 = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    pendingUnsubs.push(unsub2)

    // channel() should have been called twice — once for each subscribe-after-teardown cycle.
    expect(vi.mocked(supabase.channel)).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
// broadcastScore
// ---------------------------------------------------------------------------

describe('broadcastScore', () => {
  it('sends the broadcast message to the joined tournament channel', () => {
    const unsub = subscribeTournament({ tournamentId: 't1', onScore: vi.fn() })
    pendingUnsubs.push(unsub)

    broadcastScore({ tournamentId: 't1', payload: { id: 'm1', score1: 2, score2: 1 } })

    expect(mockChannel.send).toHaveBeenCalledOnce()
    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'score',
      payload: { id: 'm1', score1: 2, score2: 1 },
    })
  })

  it('no-ops silently when no channel is joined for that tournamentId', () => {
    expect(() =>
      broadcastScore({ tournamentId: 'not-subscribed', payload: { id: 'm1' } }),
    ).not.toThrow()
    expect(mockChannel.send).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// schedule event — replaces the postgres_changes subscription on matches
// ---------------------------------------------------------------------------

describe('schedule events', () => {
  it('invokes registered onSchedule listeners', () => {
    const onSchedule = vi.fn()
    const unsub = subscribeTournament({ tournamentId: 't1', onSchedule })
    pendingUnsubs.push(unsub)

    // Second .on() registration is the 'schedule' handler.
    const handler = mockChannel.on.mock.calls[1][2] as () => void
    handler()

    expect(onSchedule).toHaveBeenCalledOnce()
  })

  it('does not deliver score payloads to schedule listeners', () => {
    const onSchedule = vi.fn()
    const unsub = subscribeTournament({ tournamentId: 't1', onSchedule })
    pendingUnsubs.push(unsub)

    const scoreHandler = mockChannel.on.mock.calls[0][2] as (msg: { payload: unknown }) => void
    scoreHandler({ payload: { id: 'm1', score1: 1, score2: 0 } })

    expect(onSchedule).not.toHaveBeenCalled()
  })

  it('broadcastSchedule sends an empty schedule message on the tournament channel', () => {
    const unsub = subscribeTournament({ tournamentId: 't1', onSchedule: vi.fn() })
    pendingUnsubs.push(unsub)

    broadcastSchedule({ tournamentId: 't1' })

    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'schedule',
      payload: {},
    })
  })

  it('broadcastSchedule no-ops when no channel is joined', () => {
    expect(() => broadcastSchedule({ tournamentId: 'not-subscribed' })).not.toThrow()
    expect(mockChannel.send).not.toHaveBeenCalled()
  })
})
