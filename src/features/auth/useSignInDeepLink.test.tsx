// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

const { mockUseApp } = vi.hoisted(() => ({ mockUseApp: vi.fn() }))
vi.mock('../../context/useApp', () => ({ useApp: mockUseApp }))

import { parseSignInDeepLink, useSignInDeepLink } from './useSignInDeepLink'

const render = ({ url, session }: { url: string; session: unknown }) => {
  mockUseApp.mockReturnValue({ session, sessionSettled: true })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ link: useSignInDeepLink(), location: useLocation() }), { wrapper })
}

beforeEach(() => vi.clearAllMocks())

describe('parseSignInDeepLink', () => {
  it('trims and lower-cases the email, ignoring one without @', () => {
    expect(parseSignInDeepLink({ search: '?signin=1&email=%20Ada%40Example.com%20' })).toEqual({
      requested: true,
      email: 'ada@example.com',
    })
    expect(parseSignInDeepLink({ search: '?signin=1&email=nope' }).email).toBe('')
    expect(parseSignInDeepLink({ search: '' }).requested).toBe(false)
  })
})

describe('useSignInDeepLink', () => {
  it('opens the modal prefilled when signed out, and strips both params', async () => {
    const { result } = render({ url: '/home?signin=1&email=ada%40example.com&x=1', session: null })

    await waitFor(() => expect(result.current.link.open).toBe(true))
    expect(result.current.link.initialEmail).toBe('ada@example.com')
    expect(result.current.location.search).toBe('?x=1')
  })

  it('does nothing but strip the params when signed in', async () => {
    const { result } = render({
      url: '/home?signin=1&email=ada%40example.com',
      session: { user: {} },
    })

    await waitFor(() => expect(result.current.location.search).toBe(''))
    expect(result.current.link.open).toBe(false)
  })

  it('clears the modal when a session appears another way', async () => {
    const { result, rerender } = render({ url: '/home?signin=1', session: null })
    await waitFor(() => expect(result.current.link.open).toBe(true))

    mockUseApp.mockReturnValue({ session: { user: {} }, sessionSettled: true })
    rerender()
    expect(result.current.link.open).toBe(false)
    mockUseApp.mockReturnValue({ session: null, sessionSettled: true })
    rerender()

    expect(result.current.link.open).toBe(false)
  })

  it('leaves a protected path to the gate', () => {
    const { result } = render({ url: '/events?signin=1&email=ada%40example.com', session: null })

    expect(result.current.link.open).toBe(false)
    expect(result.current.location.search).toBe('?signin=1&email=ada%40example.com')
  })

  it('ignores routes without the param', () => {
    const { result } = render({ url: '/home', session: null })

    expect(result.current.link.open).toBe(false)
  })
})
