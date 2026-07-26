import type { ReactElement } from 'react'

// Helpers for component tests that call a component as a plain function and
// inspect the returned element. Props are `unknown` rather than `any` so these
// tests stay clean under the no-explicit-any ratchet.
type TestElement = ReactElement<{ [key: string]: unknown; children?: unknown }>

export const propsOf = (el: unknown) => (el as TestElement).props

export const childrenOf = (el: unknown) => {
  const { children } = propsOf(el)
  return Array.isArray(children) ? children : []
}
