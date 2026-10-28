// @vitest-environment jsdom
import { flushSync } from 'react-dom'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Menu, MenuItem } from './Menu'

afterEach(() => {
  cleanup()
})

const item = (label: string) => screen.getByText(label).closest('button')

function renderMenu({ onEdit = () => {} }: { onEdit?: () => void } = {}) {
  render(
    <Menu label="Admin tools" trigger={(props) => <button {...props}>Open</button>}>
      <MenuItem onSelect={onEdit}>Edit</MenuItem>
      <MenuItem onSelect={() => {}} current>
        Paid
      </MenuItem>
      <MenuItem onSelect={() => {}}>Delete</MenuItem>
    </Menu>,
  )
  return screen.getByText('Open')
}

describe('Menu', () => {
  it('opens on the trigger and focuses the first item', () => {
    const trigger = renderMenu()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menu', { name: 'Admin tools' })).toBeTruthy()
    expect(document.activeElement).toBe(item('Edit'))
  })

  it('moves between enabled items with the arrow keys', () => {
    fireEvent.click(renderMenu())
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Delete'))
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Edit'))
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(item('Delete'))
  })

  it('closes on Escape and returns focus to the trigger', () => {
    const trigger = renderMenu()
    fireEvent.click(trigger)
    fireEvent.keyDown(item('Edit') as Element, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps Escape from reaching a surrounding panel', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    fireEvent.click(renderMenu())
    fireEvent.keyDown(item('Edit') as Element, { key: 'Escape' })
    window.removeEventListener('keydown', onWindowKey)
    expect(onWindowKey).not.toHaveBeenCalled()
  })

  it('closes and refocuses the trigger before the item acts', () => {
    let focusedDuringSelect: Element | null = null
    const onEdit = vi.fn(() => {
      focusedDuringSelect = document.activeElement
    })
    const trigger = renderMenu({ onEdit })
    fireEvent.click(trigger)
    fireEvent.click(item('Edit') as Element)
    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(focusedDuringSelect).toBe(trigger)
    expect(document.activeElement).toBe(trigger)
  })

  // A real tap or key runs microtasks between the capture and bubble listeners, so React
  // renders there; fireEvent doesn't. Flushing at the target stands in for that.
  it('acts on a real tap, which lets React render between the capture and bubble phases', () => {
    const onEdit = vi.fn()
    const trigger = renderMenu({ onEdit })
    fireEvent.click(trigger)
    const edit = item('Edit') as Element
    edit.addEventListener('click', () => flushSync(() => {}))
    fireEvent.click(edit)
    expect(onEdit).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('stays open when a disabled item is tapped', () => {
    fireEvent.click(renderMenu())
    fireEvent.click(item('Paid') as Element)
    expect(screen.getByRole('menu')).toBeTruthy()
  })

  it('closes on a tap outside', () => {
    fireEvent.click(renderMenu())
    const backdrop = document.querySelector('.fixed.inset-0')
    fireEvent.click(backdrop as Element)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on Tab', () => {
    fireEvent.click(renderMenu())
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
