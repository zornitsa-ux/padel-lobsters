// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'
import { Menu, MenuItem } from './Menu'
import { ConfirmProvider } from './ConfirmDialog'
import { useConfirm } from '../../lib/confirmBus'
import type { ConfirmContextValue } from '../../lib/confirmBus'

afterEach(() => {
  cleanup()
})

// Like the TeamForm player search: a field that shows a list and closes it on Escape.
function SearchField() {
  const [listOpen, setListOpen] = useState(true)
  return (
    <input
      aria-label="Search"
      aria-haspopup="menu"
      aria-expanded={listOpen}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || !listOpen) return
        e.stopPropagation()
        setListOpen(false)
      }}
    />
  )
}

function Harness({
  dismissible,
  autoFocusField = false,
  withMenu = false,
  withSearch = false,
  onConfirmed = () => {},
}: {
  dismissible?: boolean
  autoFocusField?: boolean
  withMenu?: boolean
  withSearch?: boolean
  onConfirmed?: (ok: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const confirm = useConfirm()
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit player"
        dismissible={dismissible}
      >
        <input aria-label="Name" autoFocus={autoFocusField} />
        {withSearch && <SearchField />}
        {withMenu && (
          <Menu label="Tools" trigger={(props) => <button {...props}>Tools</button>}>
            <MenuItem onSelect={() => {}}>Rename</MenuItem>
          </Menu>
        )}
        <button onClick={async () => onConfirmed(await confirm({ message: 'Save?' }))}>Save</button>
        <button onClick={() => setOpen(false)}>Done</button>
      </Modal>
    </>
  )
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
  render(
    <ConfirmProvider>
      <Harness {...props} />
    </ConfirmProvider>,
  )
  const opener = screen.getByText('Open')
  opener.focus()
  fireEvent.click(opener)
  return opener
}

describe('Modal focus', () => {
  it('focuses the sheet on open, named by its title, and hides the page behind', () => {
    const opener = renderHarness()
    const sheet = screen.getByRole('dialog', { name: 'Edit player' })
    expect(document.activeElement).toBe(sheet)
    expect(opener.closest('[aria-hidden="true"]')).toBeTruthy()
  })

  it('leaves focus on an autoFocus child', () => {
    renderHarness({ autoFocusField: true })
    expect(document.activeElement).toBe(screen.getByLabelText('Name'))
  })

  it('returns focus to the opener on close', async () => {
    const opener = renderHarness({ autoFocusField: true })
    fireEvent.click(screen.getByText('Done'))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('wraps Tab from the last element to the first, and Shift+Tab back', () => {
    renderHarness()
    const name = screen.getByLabelText('Name')
    const done = screen.getByText('Done')
    done.focus()
    fireEvent.keyDown(done, { key: 'Tab' })
    expect(document.activeElement).toBe(name)
    fireEvent.keyDown(name, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(done)
  })
})

describe('Modal Escape', () => {
  it('closes a dismissible sheet and returns focus', async () => {
    const opener = renderHarness()
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('does not close a sheet that is not dismissible', () => {
    renderHarness({ dismissible: false })
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('closes an open menu in the sheet first', async () => {
    renderHarness({ withMenu: true })
    const tools = screen.getByText('Tools')
    tools.focus()
    fireEvent.keyDown(tools, { key: 'Enter' })
    fireEvent.keyDown(screen.getByText('Rename'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('dialog')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(tools))
  })

  it('closes the list of a search field first, then the sheet', () => {
    renderHarness({ withSearch: true })
    const search = screen.getByLabelText('Search')
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(search.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(search, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves the sheet open while a composition is in progress', () => {
    renderHarness()
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape', isComposing: true })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})

describe('ConfirmDialog focus', () => {
  let confirmRef: ConfirmContextValue | null = null

  function ConfirmButton({ destructive = false }: { destructive?: boolean }) {
    const confirm = useConfirm()
    confirmRef = confirm
    return <button onClick={() => confirm({ message: 'Go?', destructive })}>Ask</button>
  }

  function ask(destructive: boolean) {
    render(
      <ConfirmProvider>
        <ConfirmButton destructive={destructive} />
      </ConfirmProvider>,
    )
    fireEvent.click(screen.getByText('Ask'))
    return screen.getByRole('alertdialog')
  }

  it('is named by its message when it has no title', () => {
    ask(false)
    expect(screen.getByRole('alertdialog', { name: 'Go?' })).toBeTruthy()
  })

  it('focuses Confirm, so Enter confirms', () => {
    ask(false)
    expect(document.activeElement).toBe(screen.getByText('Confirm'))
  })

  it('focuses Cancel in a destructive flow, so Enter cannot delete', () => {
    ask(true)
    expect(document.activeElement).toBe(screen.getByText('Cancel'))
  })

  it('moves focus to Cancel when a destructive confirm follows another while open', () => {
    ask(false)
    act(() => {
      fireEvent.click(screen.getByText('Confirm'))
      void confirmRef?.({ message: 'Delete?', confirmLabel: 'Delete', destructive: true })
    })
    expect(screen.getByRole('alertdialog', { name: 'Delete?' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByText('Cancel'))
  })

  it('opened from inside a sheet, Escape closes only the confirm and refocuses its opener', async () => {
    const onConfirmed = vi.fn()
    renderHarness({ onConfirmed })
    const save = screen.getByText('Save')
    save.focus()
    fireEvent.click(save)
    expect(document.activeElement).toBe(screen.getByText('Confirm'))

    await act(async () => {
      fireEvent.keyDown(screen.getByText('Confirm'), { key: 'Escape' })
    })

    expect(onConfirmed).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Edit player' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(save))
  })
})

describe('Modal and the page around it', () => {
  it('keeps toasts audible and treats a tap on one as inside the sheet', async () => {
    const onClose = vi.fn()
    render(
      <>
        <div data-toast-viewport aria-live="polite">
          <button>Dismiss toast</button>
        </div>
        <Modal open onClose={onClose} title="Edit player">
          body
        </Modal>
      </>,
    )
    const toast = screen.getByText('Dismiss toast')
    expect(toast.closest('[aria-hidden="true"]')).toBeNull()

    await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
    fireEvent.pointerDown(toast, { button: 0 })
    fireEvent.click(toast)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps clicks in the sheet from reaching what renders it', () => {
    const onRowClick = vi.fn()
    render(
      <div onClick={onRowClick}>
        <Modal open onClose={() => {}} title="Edit player">
          <button>Inside</button>
        </Modal>
      </div>,
    )
    fireEvent.click(screen.getByText('Inside'))
    expect(onRowClick).not.toHaveBeenCalled()
  })
})
