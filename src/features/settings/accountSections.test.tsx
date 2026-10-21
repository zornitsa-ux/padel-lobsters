// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { childrenOf, propsOf } from '../../test/element'
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

const accountSection = (props: Partial<Parameters<typeof AccountSection>[0]> = {}) => (
  <AccountSection isAdmin={false} signedInPlayer={null} logout={() => {}} {...props} />
)

afterEach(cleanup)

describe('AccountSection', () => {
  it('shows the inline sign-in form, without PIN, for a guest', () => {
    render(accountSection())

    const form = screen.getByTestId('sign-in-form')
    expect(form.getAttribute('data-variant')).toBe('inline')
    expect(form.getAttribute('data-allow-pin')).toBe('false')
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  it('shows the signed-in player instead of the sign-in form', () => {
    render(accountSection({ signedInPlayer: player }))

    expect(screen.getByText(/signed in as/i).textContent).toContain('Ada Lovelace')
    expect(screen.queryByTestId('sign-in-form')).toBeNull()
  })

  it('shows admin mode, with the player first name when both are active', () => {
    render(accountSection({ isAdmin: true, signedInPlayer: player }))

    expect(screen.getByText(/admin mode active/i)).toBeTruthy()
    expect(screen.getByText(/also signed in as Ada/i)).toBeTruthy()
  })

  it('falls back to a generic line when an admin has no player identity', () => {
    render(accountSection({ isAdmin: true }))

    expect(screen.getByText(/you can edit all data/i)).toBeTruthy()
  })
})

describe('AccountOrdersSection', () => {
  it('renders nothing without a player', () => {
    expect(AccountOrdersSection({ myPlayer: null })).toBeNull()
  })

  it('passes the player id down to the orders list', () => {
    const el = AccountOrdersSection({ myPlayer: player })
    const [, ordersList] = childrenOf(el)

    expect(propsOf(ordersList).playerId).toBe('p1')
  })
})
