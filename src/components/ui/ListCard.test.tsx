// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CheckRow, LinkRow, ListCard, ListRow } from './ListCard'

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

  it('inset: divided rows with no card, and its ListRows drop their side padding', () => {
    render(
      <ListCard label="Tips" inset>
        <ListRow>
          <span>Bend your knees</span>
        </ListRow>
      </ListCard>,
    )
    const list = screen.getByRole('list', { name: 'Tips' })
    expect(list.className).not.toContain('card')
    expect(list.className).toContain('divide-y')
    expect(screen.getByText('Bend your knees').parentElement!.className).not.toContain('px-4')
  })

  it('renders nothing when every row is empty', () => {
    render(<ListCard label="Players">{[null, false]}</ListCard>)
    expect(screen.queryByRole('list')).toBeNull()
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

describe('ListRow', () => {
  it('is a padded row that holds its own controls', () => {
    render(
      <ListCard label="Registered">
        <ListRow>
          <span>Ana</span>
          <button type="button">Transfer</button>
        </ListRow>
      </ListCard>,
    )
    const [item] = screen.getAllByRole('listitem')
    expect(item.textContent).toBe('AnaTransfer')
    expect(item.firstElementChild?.className).toContain('px-4')
  })
})

describe('CheckRow', () => {
  it('is a checkbox that toggles from anywhere on the row', () => {
    const onToggle = vi.fn()
    render(
      <CheckRow checked onToggle={onToggle}>
        Ana
      </CheckRow>,
    )
    const box = screen.getByRole('checkbox', { name: 'Ana' })
    expect(box.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(box)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('locks a disabled row', () => {
    const onToggle = vi.fn()
    render(
      <CheckRow checked={false} onToggle={onToggle} disabled>
        Ben
      </CheckRow>,
    )
    const box = screen.getByRole('checkbox', { name: 'Ben' })
    expect(box.getAttribute('aria-checked')).toBe('false')
    expect((box as HTMLButtonElement).disabled).toBe(true)
  })
})
