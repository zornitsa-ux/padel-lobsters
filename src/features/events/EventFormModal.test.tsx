// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import EventFormModal from './EventFormModal'
import { emptyForm } from './eventConstants'

const noop = () => {}

const renderModal = () =>
  render(
    <EventFormModal
      open
      editId={null}
      form={{ ...emptyForm, name: 'Lobsters #12', date: '2026-08-01' }}
      setForm={noop}
      saving={false}
      onSubmit={noop}
      onClose={noop}
      addCourt={noop}
      removeCourt={noop}
      setCourt={noop}
    />,
  )

afterEach(cleanup)

// D-020 / D-028: one format, so no picker. A select here would let an admin
// route a new event to a V1 generator.
describe('EventFormModal — Lobster-only events', () => {
  it('offers no format picker', () => {
    renderModal()

    expect(screen.queryByText('Format')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    for (const label of ['Americano', 'Mexicano', 'Round Robin', 'Knockout']) {
      expect(screen.queryByText(label)).toBeNull()
    }
  })

  it('still renders the fields it owns', () => {
    renderModal()

    expect(screen.getByText('Max Players')).toBeTruthy()
    expect(screen.getByText('Duration')).toBeTruthy()
    expect(screen.getByText('Player Mix')).toBeTruthy()
  })

  it('defaults a new event to Lobster Matching', () => {
    expect(emptyForm.format).toBe('lobster_matching')
  })
})
