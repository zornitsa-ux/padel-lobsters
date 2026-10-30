// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Section } from './Section'

afterEach(cleanup)

describe('Section', () => {
  it('is a region named by its heading, not a card', () => {
    render(
      <Section title="Players (3)">
        <p>Body</p>
      </Section>,
    )
    const region = screen.getByRole('region', { name: 'Players (3)' })
    expect(screen.getByRole('heading', { level: 2, name: 'Players (3)' })).toBeTruthy()
    expect(region.className).not.toContain('card')
    expect(screen.getByText('Body')).toBeTruthy()
  })

  it('renders the icon hidden from screen readers, and the action', () => {
    render(
      <Section title="Matches" icon={<svg data-testid="icon" />} action={<span>Show all</span>}>
        <p>Body</p>
      </Section>,
    )
    expect(screen.getByTestId('icon').parentElement?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('Show all')).toBeTruthy()
  })
})
