// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { mockCopy } = vi.hoisted(() => ({ mockCopy: vi.fn() }))
vi.mock('../../lib/whatsapp', () => ({ copyToClipboard: mockCopy }))

import { ShareSheet } from './ShareSheet'

const message = '🦞 LOBSTER CUP\n\nSign up: https://padelobsters.nl/events/t1'
const url = 'https://padelobsters.nl/events/t1'

const renderSheet = (onClose = vi.fn()) =>
  render(<ShareSheet open onClose={onClose} title="Share event" message={message} url={url} />)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  mockCopy.mockReset()
})

describe('ShareSheet', () => {
  it('shows the message as it will be sent', () => {
    renderSheet()
    expect(screen.getByTestId('share-message').textContent).toBe(message)
  })

  it('links WhatsApp with the message pre-filled', () => {
    renderSheet()
    const link = screen.getByRole('link', { name: /WhatsApp/ })
    expect(link.getAttribute('href')).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`)
  })

  it('copies the message or the link, and says so', async () => {
    mockCopy.mockResolvedValue(true)
    renderSheet()

    fireEvent.click(screen.getByRole('button', { name: /Copy message/ }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Copy message\s*Copied/ })).toBeTruthy(),
    )
    expect(mockCopy).toHaveBeenLastCalledWith(message)

    fireEvent.click(screen.getByRole('button', { name: /Copy link/ }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Copy link\s*Copied/ })).toBeTruthy(),
    )
    expect(mockCopy).toHaveBeenLastCalledWith(url)
  })

  it('hides the native option where the browser has no share sheet', () => {
    renderSheet()
    expect(screen.queryByRole('button', { name: /Share via/ })).toBeNull()
  })

  it('hands the message to the native share sheet and closes once shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share })
    const onClose = vi.fn()
    renderSheet(onClose)

    fireEvent.click(screen.getByRole('button', { name: /Share via/ }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(share).toHaveBeenCalledWith({ title: 'Share event', text: message })
  })

  it('stays open when the native share is dismissed', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    vi.stubGlobal('navigator', { ...navigator, share })
    const onClose = vi.fn()
    renderSheet(onClose)

    fireEvent.click(screen.getByRole('button', { name: /Share via/ }))

    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
  })
})
