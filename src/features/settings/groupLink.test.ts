import { describe, expect, it, vi } from 'vitest'
import { openGroupLink } from './groupLink'

const fakeTab = () => ({ opener: {} as unknown, location: { href: '' }, close: vi.fn() })

describe('openGroupLink', () => {
  it('opens a tab first, then points it at the fetched link', async () => {
    const tab = fakeTab()
    const open = vi.fn(() => tab as unknown as Window)
    const ok = await openGroupLink({ fetchLink: async () => 'https://chat.whatsapp.com/x', open })
    expect(ok).toBe(true)
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(tab.location.href).toBe('https://chat.whatsapp.com/x')
    expect(tab.opener).toBeNull()
  })

  it('closes the tab when there is no link', async () => {
    const tab = fakeTab()
    const ok = await openGroupLink({
      fetchLink: async () => null,
      open: () => tab as unknown as Window,
    })
    expect(ok).toBe(false)
    expect(tab.close).toHaveBeenCalled()
  })

  it('closes the tab when the fetch fails', async () => {
    const tab = fakeTab()
    const ok = await openGroupLink({
      fetchLink: async () => {
        throw new Error('offline')
      },
      open: () => tab as unknown as Window,
    })
    expect(ok).toBe(false)
    expect(tab.close).toHaveBeenCalled()
  })

  it('opens the link in this tab when the new tab was blocked', async () => {
    const navigate = vi.fn()
    const ok = await openGroupLink({
      fetchLink: async () => 'https://chat.whatsapp.com/x',
      open: () => null,
      navigate,
    })
    expect(ok).toBe(true)
    expect(navigate).toHaveBeenCalledWith('https://chat.whatsapp.com/x')
  })
})
