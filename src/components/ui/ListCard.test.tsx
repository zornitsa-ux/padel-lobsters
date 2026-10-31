// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CheckRow, DragRow, LinkRow, ListCard, ListRow } from './ListCard'
import { moveItem, useDragReorder } from './useDragReorder'

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
    expect(list.className).toContain('[&>li:first-child>*]:pt-0')
  })

  it('ordered: an ol, for steps whose order is the content', () => {
    render(
      <ListCard label="Steps" ordered>
        <span>Score</span>
        <span>Finish</span>
      </ListCard>,
    )
    expect(screen.getByRole('list', { name: 'Steps' }).tagName).toBe('OL')
  })

  it('scrollable: the card caps its height and scrolls inside', () => {
    render(
      <ListCard label="Log" scrollable>
        <span>One</span>
      </ListCard>,
    )
    const list = screen.getByRole('list', { name: 'Log' })
    expect(list.className).toContain('card')
    expect(list.className).toContain('overflow-y-auto')
    expect(list.className).not.toContain('overflow-hidden')
    expect(list.getAttribute('tabindex')).toBe('0')
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

function DragList({
  onMove,
  names = ['Tee', 'Cap', 'Mug'],
}: {
  onMove: (move: { from: number; to: number }) => void
  names?: string[]
}) {
  const { rowProps } = useDragReorder({ keys: names, onMove })
  return (
    <ListCard label="Items">
      {names.map((name, index) => (
        <DragRow key={name} {...rowProps(index)}>
          <span>{name}</span>
        </DragRow>
      ))}
    </ListCard>
  )
}

const rowOf = (name: string) => screen.getByText(name).closest('[draggable]') as HTMLElement
const dataTransfer = () => ({ effectAllowed: '', dropEffect: '' })

describe('DragRow and useDragReorder', () => {
  it('fades the dragged row, rings the row under it, and reports the move on drop', () => {
    const onMove = vi.fn()
    render(<DragList onMove={onMove} />)

    fireEvent.dragStart(rowOf('Tee'), { dataTransfer: dataTransfer() })
    fireEvent.dragOver(rowOf('Mug'), { dataTransfer: dataTransfer() })
    expect(rowOf('Tee').className).toContain('opacity-40')
    expect(rowOf('Mug').className).toContain('ring-2')
    expect(rowOf('Cap').className).not.toContain('ring-2')

    fireEvent.drop(rowOf('Mug'), { dataTransfer: dataTransfer() })
    expect(onMove).toHaveBeenCalledWith({ from: 0, to: 2 })
    expect(rowOf('Tee').className).not.toContain('opacity-40')
    expect(rowOf('Mug').className).not.toContain('ring-2')
  })

  it('ignores a drop on the row being dragged, and clears on drag end', () => {
    const onMove = vi.fn()
    render(<DragList onMove={onMove} />)

    fireEvent.dragStart(rowOf('Cap'), { dataTransfer: dataTransfer() })
    fireEvent.dragOver(rowOf('Cap'), { dataTransfer: dataTransfer() })
    expect(rowOf('Cap').className).not.toContain('ring-2')
    fireEvent.drop(rowOf('Cap'), { dataTransfer: dataTransfer() })
    expect(onMove).not.toHaveBeenCalled()

    fireEvent.dragStart(rowOf('Cap'), { dataTransfer: dataTransfer() })
    fireEvent.dragEnd(rowOf('Cap'))
    expect(rowOf('Cap').className).not.toContain('opacity-40')
  })

  it('moves the row that was picked up when the list changes mid-drag', () => {
    const onMove = vi.fn()
    const { rerender } = render(<DragList onMove={onMove} />)

    fireEvent.dragStart(rowOf('Cap'), { dataTransfer: dataTransfer() })
    rerender(<DragList onMove={onMove} names={['New', 'Tee', 'Cap', 'Mug']} />)
    fireEvent.dragOver(rowOf('Mug'), { dataTransfer: dataTransfer() })
    fireEvent.drop(rowOf('Mug'), { dataTransfer: dataTransfer() })
    expect(onMove).toHaveBeenCalledWith({ from: 2, to: 3 })
  })

  it('ignores a drag from outside the list, and drops the ring when the drag leaves', () => {
    render(<DragList onMove={vi.fn()} />)

    const outside = new Event('dragover', { bubbles: true, cancelable: true })
    rowOf('Tee').dispatchEvent(outside)
    expect(outside.defaultPrevented).toBe(false)

    fireEvent.dragStart(rowOf('Tee'), { dataTransfer: dataTransfer() })
    fireEvent.dragOver(rowOf('Mug'), { dataTransfer: dataTransfer() })
    expect(rowOf('Mug').className).toContain('ring-2')
    fireEvent.dragLeave(rowOf('Mug'), { relatedTarget: document.body })
    expect(rowOf('Mug').className).not.toContain('ring-2')
  })

  it('moveItem returns a new array with the item moved', () => {
    const items = ['a', 'b', 'c']
    expect(moveItem({ items, from: 0, to: 2 })).toEqual(['b', 'c', 'a'])
    expect(moveItem({ items, from: 2, to: 0 })).toEqual(['c', 'a', 'b'])
    expect(items).toEqual(['a', 'b', 'c'])
  })
})
