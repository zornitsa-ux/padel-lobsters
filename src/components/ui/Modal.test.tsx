// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

afterEach(() => {
  cleanup()
})

// The sheet renders in a portal on <body>; the backdrop wraps it. Radix starts listening for
// outside taps a tick after opening, then closes on the click that follows a pointerdown.
const backdrop = () => document.querySelector('.fixed.inset-0') as HTMLElement

async function tapBackdrop() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  fireEvent.pointerDown(backdrop(), { button: 0 })
  fireEvent.click(backdrop())
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        body
      </Modal>,
    )
    expect(screen.queryByText('body')).toBeNull()
  })

  it('closes on backdrop click by default', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        body
      </Modal>,
    )

    await tapBackdrop()

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on a click inside the sheet', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        body
      </Modal>,
    )

    fireEvent.click(screen.getByText('body'))

    expect(onClose).not.toHaveBeenCalled()
  })

  describe('dismissible={false}', () => {
    // Guards the data-loss case: ItemEditorForm and PlayerForm are long
    // forms where a stray backdrop tap would discard everything typed.
    it('ignores a backdrop click', async () => {
      const onClose = vi.fn()
      render(
        <Modal open onClose={onClose} dismissible={false}>
          body
        </Modal>,
      )

      await tapBackdrop()

      expect(onClose).not.toHaveBeenCalled()
    })

    it('ignores a drag past the close threshold', () => {
      const onClose = vi.fn()
      render(
        <Modal open onClose={onClose} dismissible={false}>
          body
        </Modal>,
      )
      const sheet = screen.getByText('body').parentElement!

      fireEvent.touchStart(sheet, { touches: [{ clientY: 0 }] })
      fireEvent.touchMove(sheet, { touches: [{ clientY: 300 }] })
      fireEvent.touchEnd(sheet)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('hides the drag handle, which would advertise a gesture that does nothing', () => {
      render(
        <Modal open onClose={() => {}}>
          body
        </Modal>,
      )
      const withHandle = document.body.querySelectorAll('.rounded-full').length

      cleanup()

      render(
        <Modal open onClose={() => {}} dismissible={false}>
          body
        </Modal>,
      )
      const withoutHandle = document.body.querySelectorAll('.rounded-full').length

      expect(withHandle).toBeGreaterThan(withoutHandle)
    })
  })

  it('closes on a drag past the threshold when dismissible', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        body
      </Modal>,
    )
    const sheet = screen.getByText('body').parentElement!

    fireEvent.touchStart(sheet, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(sheet, { touches: [{ clientY: 300 }] })
    fireEvent.touchEnd(sheet)

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
