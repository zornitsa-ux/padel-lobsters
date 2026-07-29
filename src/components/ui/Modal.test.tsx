// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

afterEach(() => {
  cleanup()
})

// The backdrop is the outer element; the sheet stops propagation, so clicking
// the sheet must not close it.
function backdropOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild as HTMLElement
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        body
      </Modal>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('closes on backdrop click by default', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal open onClose={onClose}>
        body
      </Modal>,
    )

    fireEvent.click(backdropOf(container))

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
    it('ignores a backdrop click', () => {
      const onClose = vi.fn()
      const { container } = render(
        <Modal open onClose={onClose} dismissible={false}>
          body
        </Modal>,
      )

      fireEvent.click(backdropOf(container))

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
      const { container: draggable } = render(
        <Modal open onClose={() => {}}>
          body
        </Modal>,
      )
      const withHandle = draggable.querySelectorAll('.rounded-full').length

      cleanup()

      const { container: fixed } = render(
        <Modal open onClose={() => {}} dismissible={false}>
          body
        </Modal>,
      )
      const withoutHandle = fixed.querySelectorAll('.rounded-full').length

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
