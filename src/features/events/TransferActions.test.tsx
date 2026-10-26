import { describe, expect, it, vi } from 'vitest'
import { OutgoingTransferActions, TransferResponseActions } from './TransferActions'
import { childrenOf, propsOf } from '../../test/element'

const labels = (el: unknown) => childrenOf(el).map((child) => propsOf(child).children)

describe('TransferResponseActions', () => {
  it('puts Decline first and labels only the response in flight', () => {
    const el = TransferResponseActions({
      busy: 'accept',
      acceptLabel: 'Accept spot',
      onRespond: vi.fn(),
    })
    expect(labels(el)).toEqual(['Decline', 'Accepting…'])
    expect(childrenOf(el).every((child) => propsOf(child).disabled)).toBe(true)
  })

  it('labels both when the caller does not track which response is in flight', () => {
    const el = TransferResponseActions({ busy: true, acceptLabel: 'Accept', onRespond: vi.fn() })
    expect(labels(el)).toEqual(['Declining…', 'Accepting…'])
  })

  it('reports the chosen response', () => {
    const onRespond = vi.fn()
    const [decline, accept] = childrenOf(
      TransferResponseActions({ busy: false, acceptLabel: 'Accept', onRespond }),
    )
    ;(propsOf(decline).onClick as () => void)()
    ;(propsOf(accept).onClick as () => void)()
    expect(onRespond.mock.calls).toEqual([[{ accept: false }], [{ accept: true }]])
  })
})

describe('OutgoingTransferActions', () => {
  it('leaves out Resend when there is no recipient to message', () => {
    const [resend, cancel] = childrenOf(OutgoingTransferActions({ onCancel: vi.fn(), busy: false }))
    expect(resend).toBeUndefined()
    expect(propsOf(cancel).children).toBe('Cancel offer')
  })

  it('shows Cancelling… and disables both while busy', () => {
    const [resend, cancel] = childrenOf(
      OutgoingTransferActions({ onResend: vi.fn(), onCancel: vi.fn(), busy: true }),
    )
    expect(propsOf(resend).disabled).toBe(true)
    expect(propsOf(cancel).children).toBe('Cancelling…')
  })
})
