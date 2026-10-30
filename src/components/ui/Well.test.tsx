// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Well } from './Well'

afterEach(cleanup)

describe('Well', () => {
  it('is a flat lob-well inset, not a card', () => {
    render(
      <Well>
        <p>Body</p>
      </Well>,
    )
    const well = screen.getByText('Body').parentElement!
    expect(well.className).toContain('bg-lob-well')
    expect(well.className).not.toMatch(/\bcard\b|shadow|border/)
  })
})
