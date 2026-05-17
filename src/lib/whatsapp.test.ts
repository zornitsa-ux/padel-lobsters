import { describe, expect, it, vi } from 'vitest'
import {
  APP_BASE_URL,
  buildDirectChatUrl,
  buildTransferMessage,
  buildTransferUrl,
  isE164,
  normalizePhone,
  shareToDirectChat,
} from './whatsapp'

describe('whatsapp helpers', () => {
  it('normalizes phone formats and validates E.164', () => {
    expect(normalizePhone('+31 6-1234(5678)')).toBe('+31612345678')
    expect(isE164('+31612345678')).toBe(true)
    expect(isE164('0612345678')).toBe(false)
  })

  it('builds transfer URL and human message', () => {
    expect(buildTransferUrl('abc 123')).toBe(`${APP_BASE_URL}/transfer/abc%20123`)
    expect(buildTransferMessage('Melanie Smith', 'tx1')).toContain('Hi Melanie,')
    expect(buildTransferMessage('Melanie Smith', 'tx1')).toContain('/transfer/tx1')
  })

  it('builds/open direct chat only for valid phone', () => {
    expect(buildDirectChatUrl('0612345678', 'hello')).toBeNull()

    const open = vi.fn()
    Object.defineProperty(globalThis, 'window', {
      value: { open },
      configurable: true,
    })

    const ok = shareToDirectChat('+31612345678', 'hello')
    expect(ok).toBe(true)
    expect(open).toHaveBeenCalledOnce()

    const no = shareToDirectChat('0612345678', 'hello')
    expect(no).toBe(false)
  })
})
