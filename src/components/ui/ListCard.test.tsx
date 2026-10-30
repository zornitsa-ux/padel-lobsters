// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LinkRow, ListCard } from './ListCard'

afterEach(cleanup)

describe('ListCard', () => {
  it('is one card listing each child as an item', () => {
    render(
      <ListCard label="Players">
        <span>Ana</span>
        {false}
        <span>Ben</span>
      </ListCard>,
    )
    const list = screen.getByRole('list', { name: 'Players' })
    expect(list.className).toContain('card')
    expect(list.className).toContain('divide-y')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Ana', 'Ben'])
  })
})

describe('LinkRow', () => {
  it('is a link with the LinkCard content, without a card of its own', () => {
    render(
      <MemoryRouter>
        <LinkRow to="/community/1" title="Ana" subtitle="Level 2.5" trailing={<span>3.0</span>} />
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: /Ana/ })
    expect(link.getAttribute('href')).toBe('/community/1')
    expect(link.className).not.toContain('card')
    expect(screen.getByText('Level 2.5')).toBeTruthy()
    expect(screen.getByText('3.0')).toBeTruthy()
  })

  it('tints a highlighted row', () => {
    render(
      <MemoryRouter>
        <LinkRow to="/community/1" title="Ana" highlighted />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Ana' }).className).toContain('bg-lob-teal-light')
  })

  it('renders a button that runs onClick', () => {
    const onClick = vi.fn()
    render(<LinkRow onClick={onClick} title="Open" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
