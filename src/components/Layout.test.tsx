// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const { mockUseApp, mockUseSettings } = vi.hoisted(() => ({
  mockUseApp: vi.fn(),
  mockUseSettings: vi.fn(),
}))

vi.mock('../context/useApp', () => ({ useApp: mockUseApp }))
vi.mock('../features/settings/useSettings', () => ({ useSettings: mockUseSettings }))
vi.mock('../features/auth/useSignInDeepLink', () => ({
  useSignInDeepLink: () => ({ open: false, initialEmail: '', close: () => {} }),
}))
vi.mock('./ui/AuthGate', () => ({ SignInModal: () => null }))
vi.mock('../lib/toastBus', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('react-router-dom', () => ({
  NavLink: ({ to }: { to: string }) => <a href={to}>{to}</a>,
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
}))

import Layout from './Layout'

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mockUseApp.mockReturnValue({ session: { user: { id: 'p1' } }, role: 'player', isAdmin: false })
  mockUseSettings.mockReturnValue({ data: {} })
})

afterEach(cleanup)

describe('Layout — shell', () => {
  it('adds the Admin tab only for admin sessions', async () => {
    render(<Layout>content</Layout>)
    expect(screen.queryByText('/admin')).toBeNull()
    cleanup()
    mockUseApp.mockReturnValue({ session: { user: { id: 'p1' } }, role: 'admin', isAdmin: true })
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

  it('gives signed-out visitors a WhatsApp button with no link in the page', async () => {
    mockUseApp.mockReturnValue({ session: null, role: 'guest', isAdmin: false })
    const { container } = render(<Layout>content</Layout>)
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeTruthy()
    expect(container.innerHTML).not.toContain('chat.whatsapp.com')
  })
})
