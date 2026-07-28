import { describe, expect, it, vi } from 'vitest'
import { propsOf } from '../test/element'

const { mockUseApp } = vi.hoisted(() => ({ mockUseApp: vi.fn() }))
vi.mock('../context/useApp', () => ({ useApp: mockUseApp }))

import SetupGuard from './SetupGuard'

describe('SetupGuard', () => {
  it('renders the splash while the app is loading', () => {
    mockUseApp.mockReturnValue({ loading: true })
    const el = SetupGuard({ children: 'app' })
    const [logo, caption] = propsOf(el).children as unknown[]
    expect(propsOf(logo).src).toBe('/logo-256.webp')
    expect(propsOf(caption).children).toBe('Loading...')
  })

  it('renders children once loading settles', () => {
    mockUseApp.mockReturnValue({ loading: false })
    expect(propsOf(SetupGuard({ children: 'app' })).children).toBe('app')
  })
})
