// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { onBehalfMessage, useConfirmOnBehalf } from './confirmOnBehalf'

const mockConfirm = vi.fn()
vi.mock('./confirmBus', () => ({ useConfirm: () => mockConfirm }))

describe('onBehalfMessage', () => {
  it('lists the facts then asks for a check', () => {
    expect(onBehalfMessage({ lines: ['Captain: Alma', 'Partner: Bob'] })).toBe(
      'Captain: Alma\nPartner: Bob\n\nCheck this is the right person before you continue.',
    )
  })
})

describe('onBehalfMessage footer', () => {
  it('takes a per-action footer', () => {
    expect(onBehalfMessage({ lines: ['Mark Alma as paid'], footer: 'Check the amount.' })).toBe(
      'Mark Alma as paid\n\nCheck the amount.',
    )
  })
})

describe('useConfirmOnBehalf', () => {
  const args = { title: 'T', lines: ['a'], confirmLabel: 'Go' }

  beforeEach(() => mockConfirm.mockReset())

  it('ignores a second call while a dialog is open', async () => {
    let settle: (value: boolean) => void = () => {}
    mockConfirm.mockReturnValue(new Promise<boolean>((resolve) => (settle = resolve)))
    const { result } = renderHook(() => useConfirmOnBehalf())

    const first = result.current(args)
    const second = await result.current(args)
    settle(true)

    expect(second).toBe(false)
    expect(await first).toBe(true)
    expect(mockConfirm).toHaveBeenCalledTimes(1)
  })

  it('opens again once the dialog has closed', async () => {
    mockConfirm.mockResolvedValue(true)
    const { result } = renderHook(() => useConfirmOnBehalf())

    await result.current(args)
    await result.current(args)

    expect(mockConfirm).toHaveBeenCalledTimes(2)
  })
})
