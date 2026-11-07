// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ useApp: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: h.useApp }))

import AddEmailCard from './AddEmailCard'

const asUser = (user: { id: string; email: string } | null) =>
  h.useApp.mockReturnValue({ session: user ? { user } : null })

afterEach(cleanup)

describe('AddEmailCard', () => {
  it('renders nothing when signed out', () => {
    asUser(null)
    const { container } = render(<AddEmailCard />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing for a real email', () => {
    asUser({ id: 'p1', email: 'ada@example.com' })
    const { container } = render(<AddEmailCard />)
    expect(container.innerHTML).toBe('')
  })

  it('asks a synthetic account to message an admin, without showing the address', () => {
    asUser({ id: 'p1', email: 'player-abc@padelobsters.internal' })
    render(<AddEmailCard />)
    expect(screen.getByText('Add your email so you can keep signing in')).toBeTruthy()
    expect(screen.getByText(/PINs have retired/)).toBeTruthy()
    expect(screen.getByText(/Message an admin on WhatsApp/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('padelobsters.internal')
  })
})
