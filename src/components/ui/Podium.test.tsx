// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Podium } from './Podium'

afterEach(cleanup)

const places = [
  { name: 'Ana', points: 30 },
  { name: 'Bo', points: 24 },
  { name: 'Cy', points: 18 },
]

describe('Podium', () => {
  it('reads first to third, drawn second, first, third', () => {
    render(<Podium places={places} />)
    const steps = screen.getAllByRole('listitem')
    expect(steps.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Place 1: Ana'),
      expect.stringContaining('Place 2: Bo'),
      expect.stringContaining('Place 3: Cy'),
    ])
    expect(steps.map((li) => li.className.match(/order-\d/)?.[0])).toEqual([
      'order-2',
      'order-1',
      'order-3',
    ])
  })

  it('shows points in medal colours', () => {
    render(<Podium places={places} />)
    expect(screen.getByText('30pts').className).toContain('bg-lob-gold')
    expect(screen.getByText('24pts').className).toContain('bg-lob-silver-soft')
    expect(screen.getByText('18pts').className).toContain('bg-lob-bronze')
  })

  it('draws two steps with no third, and nothing with fewer than two', () => {
    render(<Podium places={places.slice(0, 2)} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    cleanup()
    const { container } = render(<Podium places={places.slice(0, 1)} />)
    expect(container.innerHTML).toBe('')
  })
})
