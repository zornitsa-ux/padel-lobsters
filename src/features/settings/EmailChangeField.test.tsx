// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../context/useApp', () => ({ useApp: () => ({ requestMyEmailChange: vi.fn() }) }))

import { EmailChangeField } from './EmailChangeField'

afterEach(cleanup)

describe('EmailChangeField', () => {
  it('shows the address and a Change button for a real email', () => {
    render(<EmailChangeField email="ada@example.com" />)
    expect(screen.getByText('ada@example.com')).toBeTruthy()
    expect(screen.getByText('Change')).toBeTruthy()
  })

  it('asks for an admin instead of showing the synthetic address or a form', () => {
    render(<EmailChangeField email="player-abc@padelobsters.internal" />)
    expect(screen.getByText(/Message an admin on WhatsApp with your email address/)).toBeTruthy()
    expect(screen.queryByText('Change')).toBeNull()
    expect(document.body.textContent).not.toContain('padelobsters.internal')
  })
})
