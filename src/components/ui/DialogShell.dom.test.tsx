// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'
import { FullScreenDialog } from './FullScreenDialog'
import { Modal } from './Modal'
import { Menu, MenuItem } from './Menu'

afterEach(() => {
  cleanup()
})

type Shape = 'fullscreen' | 'drawer'

function Harness({ shape, onClose = () => {} }: { shape: Shape; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const Shape = shape === 'fullscreen' ? FullScreenDialog : Drawer
  const close = () => {
    onClose()
    setOpen(false)
  }
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Shape open={open} onClose={close} title="Compare" description="Pick one.">
        <p role="status" aria-live="polite">
          Alternative generated
        </p>
        <button onClick={() => setSheetOpen(true)}>Edit</button>
        <Menu label="Tools" trigger={(props) => <button {...props}>Tools</button>}>
          <MenuItem onSelect={() => {}}>Rename</MenuItem>
        </Menu>
        <button>Last</button>
      </Shape>
      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Edit player">
        <button>Save</button>
      </Modal>
    </>
  )
}

function renderHarness({ shape, onClose }: { shape: Shape; onClose?: () => void }) {
  render(<Harness shape={shape} onClose={onClose} />)
  const opener = screen.getByText('Open')
  opener.focus()
  fireEvent.click(opener)
  return opener
}

// Radix starts listening for outside taps a tick after opening.
async function tap(element: Element) {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  fireEvent.pointerDown(element, { button: 0 })
  fireEvent.click(element)
}

const overlay = () => screen.getByRole('dialog').parentElement as HTMLElement

describe.each<Shape>(['fullscreen', 'drawer'])('%s dialog', (shape) => {
  it('focuses the dialog, named and described by its header, and hides the page behind', () => {
    const opener = renderHarness({ shape })
    const dialog = screen.getByRole('dialog', { name: 'Compare', description: 'Pick one.' })
    expect(document.activeElement).toBe(dialog)
    expect(opener.closest('[aria-hidden="true"]')).toBeTruthy()
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true)
  })

  it('keeps its live status line audible', () => {
    renderHarness({ shape })
    expect(screen.getByRole('status').closest('[aria-hidden="true"]')).toBeNull()
  })

  it('wraps Tab from the last element to the first', () => {
    renderHarness({ shape })
    const last = screen.getByText('Last')
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
  })

  it('closes from its X and returns focus to the opener', async () => {
    const opener = renderHarness({ shape })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('closes on Escape and returns focus to the opener', async () => {
    const opener = renderHarness({ shape })
    fireEvent.keyDown(screen.getByText('Last'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('closes only a sheet opened inside it on Escape', async () => {
    renderHarness({ shape })
    const edit = screen.getByText('Edit')
    edit.focus()
    fireEvent.click(edit)
    fireEvent.keyDown(screen.getByText('Save'), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Edit player' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Compare' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(edit))
  })

  it('closes only a menu opened inside it on Escape', async () => {
    renderHarness({ shape })
    const tools = screen.getByText('Tools')
    tools.focus()
    fireEvent.keyDown(tools, { key: 'Enter' })
    fireEvent.keyDown(screen.getByText('Rename'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Compare' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(tools))
  })
})

describe('Drawer', () => {
  it('closes on a backdrop tap', async () => {
    const onClose = vi.fn()
    renderHarness({ shape: 'drawer', onClose })
    await tap(overlay())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('FullScreenDialog', () => {
  it('stays open on a tap beside its column, which is still on the dialog', async () => {
    const onClose = vi.fn()
    renderHarness({ shape: 'fullscreen', onClose })
    await tap(overlay())
    expect(onClose).not.toHaveBeenCalled()
  })
})
