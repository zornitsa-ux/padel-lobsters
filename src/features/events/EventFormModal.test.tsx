// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import EventFormModal from './EventFormModal'
import { emptyForm, type EventFormValues } from './eventConstants'
import {
  buildEventData,
  hasSignups,
  isEntryModeLocked,
  maxTeamsFromTournament,
} from './eventFormModel'

const noop = () => {}

const baseForm: EventFormValues = { ...emptyForm, name: 'Lobsters #12', date: '2026-08-01' }

let latestForm: EventFormValues = baseForm

function Harness({
  initial = baseForm,
  formatLocked = false,
}: {
  initial?: EventFormValues
  formatLocked?: boolean
}) {
  const [form, setForm] = useState(initial)
  latestForm = form
  return (
    <EventFormModal
      open
      editId={null}
      form={form}
      setForm={setForm}
      saving={false}
      formatLocked={formatLocked}
      onSubmit={noop}
      onClose={noop}
      addCourt={noop}
      removeCourt={noop}
      setCourt={noop}
    />
  )
}

const kotcForm = (over: Partial<EventFormValues> = {}): EventFormValues => ({
  ...baseForm,
  format: 'king_of_court',
  entryMode: 'team',
  ...over,
})

afterEach(cleanup)

describe('EventFormModal — Americano', () => {
  it('keeps the Americano fields and no team UI', () => {
    render(<Harness />)

    expect(screen.getByText('Max Players')).toBeTruthy()
    expect(screen.getByText('Duration')).toBeTruthy()
    expect(screen.getByText('Player Mix')).toBeTruthy()
    expect(screen.queryByText('Max Teams')).toBeNull()
    expect(screen.queryByText(/King court/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Americano' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('saves max players and total price as before', () => {
    const data = buildEventData({
      form: { ...baseForm, maxPlayers: '12', pricePerPerson: '10' },
    })

    expect(data).toMatchObject({
      maxPlayers: 12,
      totalPrice: 120,
      format: 'lobster_matching',
      entryMode: 'individual',
    })
  })
})

describe('EventFormModal — King of the Court', () => {
  it('writes format and entry mode when switching format', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'King of the Court' }))
    expect(latestForm).toMatchObject({ format: 'king_of_court', entryMode: 'team' })

    fireEvent.click(screen.getByRole('button', { name: 'Americano' }))
    expect(latestForm).toMatchObject({ format: 'lobster_matching', entryMode: 'individual' })
  })

  it('shows Max Teams defaulting to twice the courts, with the ladder hint', () => {
    const courts = [
      { name: 'A', booked: false },
      { name: 'B', booked: false },
      { name: 'C', booked: false },
    ]
    render(<Harness initial={kotcForm({ courts })} />)

    expect(screen.queryByText('Max Players')).toBeNull()
    expect((screen.getByLabelText('Max Teams') as HTMLInputElement).value).toBe('6')
    expect(
      screen.getByText('Court order is the ladder: the first court is the King court.'),
    ).toBeTruthy()
  })

  it('saves an even max_players from the default and from a typed value', () => {
    const courts = [
      { name: 'A', booked: false },
      { name: 'B', booked: false },
    ]
    expect(buildEventData({ form: kotcForm({ courts }) })).toMatchObject({
      maxPlayers: 8,
      entryMode: 'team',
    })
    expect(buildEventData({ form: kotcForm({ courts, maxTeams: '5' }) }).maxPlayers).toBe(10)
  })

  it('loads an existing event as max_players / 2', () => {
    expect(maxTeamsFromTournament({ format: 'king_of_court', maxPlayers: 12 })).toBe('6')
    expect(maxTeamsFromTournament({ format: 'lobster_matching', maxPlayers: 12 })).toBe('')
  })

  it('prices the event as price x max_players', () => {
    const data = buildEventData({ form: kotcForm({ maxTeams: '4', pricePerPerson: '15' }) })

    expect(data.totalPrice).toBe(120)
  })

  it('shows the team total under the per-person price', () => {
    render(<Harness initial={kotcForm({ pricePerPerson: '17.5' })} />)

    expect(screen.getByText(/Team total: .*35/)).toBeTruthy()
  })
})

describe('EventFormModal — format lock', () => {
  it('disables the picker with a note when people have signed up', () => {
    render(<Harness formatLocked />)

    expect(
      (screen.getByRole('button', { name: 'King of the Court' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(screen.getByText("Format can't change once people have signed up")).toBeTruthy()
  })

  it('leaves the picker enabled otherwise', () => {
    render(<Harness />)

    expect(
      (screen.getByRole('button', { name: 'King of the Court' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    expect(screen.queryByText("Format can't change once people have signed up")).toBeNull()
  })

  it('counts registered and waitlisted players, not cancelled ones', () => {
    expect(hasSignups({ registrations: [{ status: 'cancelled' }] })).toBe(false)
    expect(hasSignups({ registrations: [{ status: 'cancelled' }, { status: 'waitlist' }] })).toBe(
      true,
    )
    expect(hasSignups({ registrations: [{ status: 'registered' }] })).toBe(true)
  })

  it('recognises the entry_mode_locked database error', () => {
    expect(isEntryModeLocked({ message: 'entry_mode_locked' })).toBe(true)
    expect(isEntryModeLocked(new Error('boom'))).toBe(false)
  })
})
