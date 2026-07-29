// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { childrenOf, propsOf } from '../../test/element'
import { normalisePlayers } from '../../lib/normalise'

vi.mock('../../components/ApproveDevicesWidget', () => ({
  default: () => <div data-testid="approve-devices" />,
}))

// AccountOrdersSection pulls in the merch data layer, which imports the
// supabase client module — mock it so import doesn't require real env vars.
vi.mock('../../supabase', () => ({ supabase: {} }))

import AccountSection from './AccountSection'
import AccountOrdersSection from './AccountOrdersSection'

const player = normalisePlayers([{ id: 'p1', name: 'Ada Lovelace' }])[0]

const accountSection = (props: Partial<Parameters<typeof AccountSection>[0]> = {}) => (
  <AccountSection
    isAdmin={false}
    signedInPlayer={null}
    logout={() => {}}
    signInPin=""
    setSignInPin={() => {}}
    signInError=""
    setSignInError={() => {}}
    signingIn={false}
    handleSignIn={() => {}}
    {...props}
  />
)

afterEach(cleanup)

describe('AccountSection', () => {
  it('shows the PIN form and no device widget for a guest', () => {
    render(accountSection())

    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
    expect(screen.queryByTestId('approve-devices')).toBeNull()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  it('shows the signed-in player instead of the PIN form', () => {
    render(accountSection({ signedInPlayer: player }))

    expect(screen.getByText(/signed in as/i).textContent).toContain('Ada Lovelace')
    expect(screen.getByTestId('approve-devices')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull()
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

  it('disables the submit button until the PIN is long enough', () => {
    const { rerender } = render(accountSection({ signInPin: '12' }))
    const submit = () => screen.getByRole('button', { name: /sign in/i }) as HTMLButtonElement
    expect(submit().disabled).toBe(true)

    rerender(accountSection({ signInPin: '1234' }))
    expect(submit().disabled).toBe(false)
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
