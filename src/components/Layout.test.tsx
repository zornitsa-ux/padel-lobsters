// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const { mockUseApp, mockUseSettings, mockIsMyDeviceTrusted } = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  mockUseSettings: vi.fn(),
  mockIsMyDeviceTrusted: vi.fn(),
}))

vi.mock('../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../features/settings/useSettings', () => ({ useSettings: mockUseSettings }))
vi.mock('../hooks/useDevices', () => ({
  default: () => ({ isMyDeviceTrusted: mockIsMyDeviceTrusted }),
}))
vi.mock('react-router-dom', () => ({
  NavLink: ({ to }: { to: string }) => <a href={to}>{to}</a>,
}))
vi.mock('./device-trust/DeviceTrustBanner', () => ({
  default: ({ onDismiss }: { onDismiss: () => void }) => (
    <button onClick={onDismiss}>trust-banner</button>
  ),
}))
vi.mock('./device-trust/DeviceTrustIndicator', () => ({
  default: ({ visible }: { visible: boolean }) => (visible ? <i>trust-indicator</i> : null),
}))

import Layout from './Layout'

const BANNER_KEY = 'pl_device_trust_banner_dismissed'

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mockUseApp.mockReturnValue({ session: { user: { id: 'p1', app_metadata: {} } } })
  mockUseSettings.mockReturnValue({ data: {} })
  mockIsMyDeviceTrusted.mockResolvedValue(true)
})

afterEach(cleanup)

describe('Layout — device trust banner', () => {
  it('shows the banner once the RPC reports the device is untrusted', async () => {
    mockIsMyDeviceTrusted.mockResolvedValue(false)
    render(<Layout>content</Layout>)
    expect(await screen.findByText('trust-banner')).toBeTruthy()
    expect(screen.queryByText('trust-indicator')).toBeNull()
  })

  it('stays silent for a trusted device', async () => {
    render(<Layout>content</Layout>)
    await waitFor(() => expect(mockIsMyDeviceTrusted).toHaveBeenCalledWith('p1'))
    expect(screen.queryByText('trust-banner')).toBeNull()
  })

  it('never asks about the device when nobody is signed in', async () => {
    mockUseApp.mockReturnValue({ session: null })
    render(<Layout>content</Layout>)
    await waitFor(() => expect(screen.getByText('content')).toBeTruthy())
    expect(mockIsMyDeviceTrusted).not.toHaveBeenCalled()
    expect(screen.queryByText('trust-banner')).toBeNull()
  })

  it('dismissing swaps the banner for the indicator and persists the choice', async () => {
    mockIsMyDeviceTrusted.mockResolvedValue(false)
    render(<Layout>content</Layout>)
    fireEvent.click(await screen.findByText('trust-banner'))
    expect(window.localStorage.getItem(BANNER_KEY)).toBe('true')
    expect(screen.queryByText('trust-banner')).toBeNull()
    expect(screen.getByText('trust-indicator')).toBeTruthy()
  })

  // Documented as-is: the "clear the flag once trusted" effect also runs on
  // mount, while trust is still unknown, so a stored dismissal is wiped and
  // the banner comes back on the next load.
  it('does not survive a reload — a stored dismissal is cleared on mount', async () => {
    window.localStorage.setItem(BANNER_KEY, 'true')
    mockIsMyDeviceTrusted.mockResolvedValue(false)
    render(<Layout>content</Layout>)
    expect(await screen.findByText('trust-banner')).toBeTruthy()
    expect(window.localStorage.getItem(BANNER_KEY)).toBeNull()
  })

  it('clears the stored dismissal once the device becomes trusted', async () => {
    window.localStorage.setItem(BANNER_KEY, 'true')
    render(<Layout>content</Layout>)
    await waitFor(() => expect(window.localStorage.getItem(BANNER_KEY)).toBeNull())
  })
})

describe('Layout — shell', () => {
  it('adds the Admin tab only for admin sessions', async () => {
    render(<Layout>content</Layout>)
    expect(screen.queryByText('/admin')).toBeNull()
    cleanup()
    mockUseApp.mockReturnValue({ session: { user: { id: 'p1', app_metadata: { role: 'admin' } } } })
    render(<Layout>content</Layout>)
    expect(screen.getByText('/admin')).toBeTruthy()
  })

  it('renders the WhatsApp link only when settings provide one', async () => {
    render(<Layout>content</Layout>)
    expect(screen.queryByText('WhatsApp')).toBeNull()
    cleanup()
    mockUseSettings.mockReturnValue({ data: { whatsappLink: 'https://chat.example' } })
    render(<Layout>content</Layout>)
    expect(screen.getByText('WhatsApp').closest('a')?.getAttribute('href')).toBe(
      'https://chat.example',
    )
  })
})
