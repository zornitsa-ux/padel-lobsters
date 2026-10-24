// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import EventFormModal from './EventFormModal'
import { emptyForm, type EventFormValues } from './eventConstants'
import { buildEventData, hasSignups, isEntryModeLocked, isFormatLocked } from './eventFormModel'

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
      addCourt={() =>
        setForm((f) => ({ ...f, courts: [...f.courts, { name: '', booked: false }] }))
      }
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
    expect(screen.queryByLabelText('Max Teams')).toBeNull()
    expect(screen.getByText('6 teams · 2 per court (12 players)')).toBeTruthy()
    expect(
      screen.getByText('Court order is the ladder: the first court is the King court.'),
    ).toBeTruthy()
  })

  it('saves max_players as 4 x courts', () => {
    const courts = (n: number) => Array.from({ length: n }, () => ({ name: '', booked: false }))
    expect(buildEventData({ form: kotcForm({ courts: courts(2) }) })).toMatchObject({
      maxPlayers: 8,
      entryMode: 'team',
    })
    expect(buildEventData({ form: kotcForm({ courts: courts(5) }) }).maxPlayers).toBe(20)
  })

  it('updates the capacity line as courts are added', () => {
    render(<Harness initial={kotcForm({ courts: [{ name: 'A', booked: false }] })} />)
    expect(screen.getByText('2 teams · 2 per court (4 players)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /add court/i }))

    expect(screen.getByText('4 teams · 2 per court (8 players)')).toBeTruthy()
  })

  it('prices the event as price x max_players', () => {
    const data = buildEventData({
      form: kotcForm({
        courts: Array.from({ length: 2 }, () => ({ name: '', booked: false })),
        pricePerPerson: '15',
      }),
    })

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

  it('keeps the format locked while registrations load, and after a server lock', () => {
    const base = {
      editing: true,
      serverLocked: false,
      registrationsPending: false,
      registrations: [],
    }
    expect(isFormatLocked(base)).toBe(false)
    expect(isFormatLocked({ ...base, registrationsPending: true })).toBe(true)
    expect(isFormatLocked({ ...base, serverLocked: true })).toBe(true)
    expect(isFormatLocked({ ...base, registrations: [{ status: 'registered' }] })).toBe(true)
    expect(isFormatLocked({ ...base, editing: false, registrationsPending: true })).toBe(false)
  })

  it('recognises the entry_mode_locked database error', () => {
    expect(isEntryModeLocked({ message: 'entry_mode_locked' })).toBe(true)
    expect(isEntryModeLocked(new Error('boom'))).toBe(false)
  })
})
