// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'
import { ConfirmProvider } from './ConfirmDialog'
import { useConfirm } from '../../lib/confirmBus'

afterEach(() => {
  cleanup()
})

function Harness({
  dismissible,
  autoFocusField = false,
  onConfirmed = () => {},
}: {
  dismissible?: boolean
  autoFocusField?: boolean
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

const guards = () => document.querySelectorAll<HTMLElement>('[data-focus-guard]')

describe('Modal focus', () => {
  it('focuses the sheet on open, named by its title', () => {
    renderHarness()
    const sheet = screen.getByRole('dialog', { name: 'Edit player' })
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(sheet)
  })

  it('leaves focus on an autoFocus child', () => {
    renderHarness({ autoFocusField: true })
    expect(document.activeElement).toBe(screen.getByLabelText('Name'))
  })

  it('returns focus to the opener on close', () => {
    const opener = renderHarness({ autoFocusField: true })
    fireEvent.click(screen.getByText('Done'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('wraps Tab from the last element to the first, and Shift+Tab back', () => {
    renderHarness()
    const [before, after] = guards()
    after.focus()
    expect(document.activeElement).toBe(screen.getByLabelText('Name'))
    before.focus()
    expect(document.activeElement).toBe(screen.getByText('Done'))
  })
})

describe('Modal Escape', () => {
  it('closes a dismissible sheet and returns focus', () => {
    const opener = renderHarness()
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('does not close a sheet that is not dismissible', () => {
    renderHarness({ dismissible: false })
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('keeps Escape from reaching a panel behind the sheet', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    renderHarness({ dismissible: false })
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' })
    window.removeEventListener('keydown', onWindowKey)
    expect(onWindowKey).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog focus', () => {
  function ConfirmButton({ destructive = false }: { destructive?: boolean }) {
    const confirm = useConfirm()
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
    expect(document.activeElement).toBe(save)
  })
})
