// @vitest-environment jsdom
import { flushSync } from 'react-dom'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Menu, MenuItem } from './Menu'
import { ConfirmProvider } from './ConfirmDialog'
import { useConfirm } from '../../lib/confirmBus'

afterEach(() => {
  cleanup()
})

const item = (label: string) => screen.getByText(label).closest('button')
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

function AdminMenu({ onEdit }: { onEdit: () => void }) {
  return (
    <Menu label="Admin tools" trigger={(props) => <button {...props}>Open</button>}>
      <MenuItem onSelect={onEdit}>Edit</MenuItem>
      <MenuItem onSelect={() => {}} current>
        Paid
      </MenuItem>
      <MenuItem onSelect={() => {}}>Delete</MenuItem>
    </Menu>
  )
}

function renderMenu({ onEdit = () => {} }: { onEdit?: () => void } = {}) {
  render(<AdminMenu onEdit={onEdit} />)
  return screen.getByText('Open')
}

function openWithKeyboard(trigger: HTMLElement) {
  trigger.focus()
  fireEvent.keyDown(trigger, { key: 'Enter' })
}

describe('Menu', () => {
  it('opens from the keyboard, named by its label, with the first item focused', () => {
    const trigger = renderMenu()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    openWithKeyboard(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu', { name: 'Admin tools' })).toBeTruthy()
    expect(document.activeElement).toBe(item('Edit'))
  })

  it('opens on a mouse press of the trigger', () => {
    const trigger = renderMenu()
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('opens on the click of a tap, not on touch down, which may start a scroll', () => {
    const trigger = renderMenu()
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'touch' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  // Radix moves focus in a timeout after the key.
  it('moves between enabled items with the arrow keys, wrapping around', async () => {
    openWithKeyboard(renderMenu())
    fireEvent.keyDown(item('Edit') as Element, { key: 'ArrowDown' })
    await waitFor(() => expect(document.activeElement).toBe(item('Delete')))
    fireEvent.keyDown(item('Delete') as Element, { key: 'ArrowDown' })
    await waitFor(() => expect(document.activeElement).toBe(item('Edit')))
    fireEvent.keyDown(item('Edit') as Element, { key: 'End' })
    await waitFor(() => expect(document.activeElement).toBe(item('Delete')))
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const trigger = renderMenu()
    openWithKeyboard(trigger)
    fireEvent.keyDown(item('Edit') as Element, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('closes, refocuses the trigger, then runs the chosen item', async () => {
    let focusWhenRun: Element | null = null
    const onEdit = vi.fn(() => {
      focusWhenRun = document.activeElement
    })
    const trigger = renderMenu({ onEdit })
    openWithKeyboard(trigger)
    fireEvent.click(item('Edit') as Element)
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce())
    expect(focusWhenRun).toBe(trigger)
    expect(document.activeElement).toBe(trigger)
  })

  it('leaves focus where the item moved it', async () => {
    const field = document.createElement('input')
    document.body.append(field)
    openWithKeyboard(renderMenu({ onEdit: () => field.focus() }))
    fireEvent.keyDown(item('Edit') as Element, { key: 'Enter' })
    await waitFor(() => expect(document.activeElement).toBe(field))
    field.remove()
  })

  // A real tap runs microtasks between the capture and bubble listeners, so React renders
  // there; fireEvent doesn't. Flushing at the target stands in for that (#88).
  it('acts on a real tap, which lets React render between the capture and bubble phases', async () => {
    const onEdit = vi.fn()
    openWithKeyboard(renderMenu({ onEdit }))
    const edit = item('Edit') as Element
    edit.addEventListener('click', () => flushSync(() => {}))
    fireEvent.click(edit)
    await waitFor(() => expect(onEdit).toHaveBeenCalledOnce())
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('stays open when a disabled item is tapped', () => {
    openWithKeyboard(renderMenu())
    fireEvent.click(item('Paid') as Element)
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('closes on a tap outside', async () => {
    openWithKeyboard(renderMenu())
    await tick()
    fireEvent.pointerDown(document.body, { button: 0 })
    fireEvent.click(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

// Like the Payments "Mark Paid" picker: the item asks for a confirmation.
function ConfirmingMenu({ onConfirmed }: { onConfirmed: (ok: boolean) => void }) {
  const confirm = useConfirm()
  return <AdminMenu onEdit={async () => onConfirmed(await confirm({ message: 'Mark as paid?' }))} />
}

describe('Menu with a dialog opened by an item', () => {
  it('focuses the dialog, then returns focus to the trigger when it closes', async () => {
    const onConfirmed = vi.fn()
    render(
      <ConfirmProvider>
        <ConfirmingMenu onConfirmed={onConfirmed} />
      </ConfirmProvider>,
    )
    const trigger = screen.getByText('Open')
    openWithKeyboard(trigger)
    fireEvent.keyDown(item('Edit') as Element, { key: 'Enter' })

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Confirm')))
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'))
    })
    expect(onConfirmed).toHaveBeenCalledWith(false)
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
