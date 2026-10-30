// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../hooks/useLeagueMutations', () => ({
  useCreateTeam: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateTeam: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import { TeamForm } from './TeamForm'

const PLAYERS = [
  { id: 'p1', name: 'Ana Ruiz', status: 'active' },
  { id: 'p2', name: 'Ben Okafor', status: 'active' },
]

afterEach(() => {
  cleanup()
})

function renderForm() {
  render(
    <TeamForm
      leagueId="l1"
      division="mens"
      players={PLAYERS}
      onSuccess={() => {}}
      onCancel={() => {}}
    />,
  )
  return screen.getAllByPlaceholderText('Search by name…')[0]
}

const item = (label: string) => screen.getByText(label).closest('button')

describe('TeamForm player search', () => {
  it('opens on focus and moves into the list with ArrowDown', () => {
    const input = renderForm()
    fireEvent.focus(input)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Ana Ruiz'))
  })

  it('focuses the first item on ArrowDown while closed', () => {
    const input = renderForm()
    input.focus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Ana Ruiz'))
  })

  it('closes on Escape from an item and returns focus to the input', () => {
    const input = renderForm()
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(input)
  })

  it('keeps Escape that closes the list from closing the sheet around the form', () => {
    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    const input = renderForm()
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onWindowKey).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    window.removeEventListener('keydown', onWindowKey)
    expect(onWindowKey).toHaveBeenCalledOnce()
  })

  it('returns focus to the input after choosing a player', () => {
    const input = renderForm()
    input.focus()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.click(document.activeElement as Element)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(input)
    expect(screen.getByText('Ana Ruiz')).toBeTruthy()
  })

  it('offers a placeholder only for a name that is not on the list', () => {
    const input = renderForm()
    input.focus()
    fireEvent.change(input, { target: { value: 'Zed' } })
    expect(item('Create placeholder: Zed')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'ana ruiz' } })
    expect(screen.queryByText(/Create placeholder/)).toBeNull()
    expect(item('Ana Ruiz')).toBeTruthy()
  })
})

describe('TeamForm player errors', () => {
  it('marks the empty player invalid on save and clears it once a player is chosen', () => {
    const input = renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save Team' }))
    const error = screen.getAllByRole('alert')[0]
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe(error.id)

    fireEvent.focus(input)
    fireEvent.click(item('Ana Ruiz') as Element)
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    expect(screen.queryByText(error.textContent ?? '')).toBeNull()
  })
})
