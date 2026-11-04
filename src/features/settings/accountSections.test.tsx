// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { propsOf } from '../../test/element'
import { normalisePlayers } from '../../lib/normalise'
import { mockSupabase } from '../../test/mockSupabase'

// AccountOrdersSection pulls in the merch data layer, which imports the
// supabase client module.
vi.mock('../../supabase', () => mockSupabase())
vi.mock('../auth/SignInForm', () => ({
  default: ({ variant, allowPin }: { variant: string; allowPin: boolean }) => (
    <div data-testid="sign-in-form" data-variant={variant} data-allow-pin={String(allowPin)} />
  ),
}))

import AccountSection from './AccountSection'
import AccountOrdersSection from './AccountOrdersSection'

const player = normalisePlayers([{ id: 'p1', name: 'Ada Lovelace' }])[0]

afterEach(cleanup)

describe('AccountSection', () => {
  it('shows the inline sign-in form, without PIN, for a guest', () => {
    render(<AccountSection />)

    const form = screen.getByTestId('sign-in-form')
    expect(form.getAttribute('data-variant')).toBe('inline')
    expect(form.getAttribute('data-allow-pin')).toBe('false')
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })
})

describe('AccountOrdersSection', () => {
  it('renders nothing without a player', () => {
    expect(AccountOrdersSection({ myPlayer: null })).toBeNull()
  })

  it('passes the player id down to the orders list', () => {
    const el = AccountOrdersSection({ myPlayer: player })

    expect(propsOf(el).playerId).toBe('p1')
  })
})
