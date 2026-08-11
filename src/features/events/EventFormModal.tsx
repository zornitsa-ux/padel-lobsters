import React, { type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Plus, X } from 'lucide-react'
import { fmtEur } from '../../lib/format'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { EventFormCourt, EventFormValues } from './eventConstants'

// A court field edit. `booked` is the checkbox; every other field comes off a
// text/number input as a string.
export type SetEventFormCourt = <K extends keyof EventFormCourt>(
  index: number,
  field: K,
  value: EventFormCourt[K],
) => void

interface EventFormModalProps {
  open: boolean
  /** Present when editing an existing event, null when creating one. */
  editId: string | null
  form: EventFormValues
  setForm: Dispatch<SetStateAction<EventFormValues>>
  saving: boolean
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  addCourt: () => void
  removeCourt: (index: number) => void
  setCourt: SetEventFormCourt
}

export default function EventFormModal({
  open,
  editId,
  form,
  setForm,
  saving,
  onSubmit,
  onClose,
  addCourt,
  removeCourt,
  setCourt,
}: EventFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editId ? 'Edit Event' : 'New Event'}
      footer={
        <button type="submit" form="event-form" disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Event'}
        </button>
      }
    >
      <form id="event-form" onSubmit={onSubmit} className="space-y-5">
        {/* Event name */}
        <div>
          <label className="label">Event Name *</label>
          <input
            required
            className="input"
            placeholder="e.g. Lobsters Americano #12"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Location */}
        <div>
          <label className="label">Location (Club / Venue)</label>
          <input
            className="input"
            placeholder="e.g. Padel City Amsterdam"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date *</label>
            <input
              required
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Time</label>
            <input
              type="time"
              className="input"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
            />
          </div>
        </div>

        {/* Max players — every event is Lobster Matching (D-020), so there is
            no format picker: the matcher is the only generator. */}
        <div>
          <label className="label">Max Players</label>
          <input
            type="number"
            min="4"
            max="64"
            step="4"
            className="input"
            value={form.maxPlayers}
            onChange={(e) => setForm((f) => ({ ...f, maxPlayers: e.target.value }))}
          />
        </div>

        {/* Duration */}
        <div>
          <label className="label">Duration</label>
          <SegmentedControl
            ariaLabel="Duration"
            options={[
              { value: 60, label: '1h' },
              { value: 90, label: '1.5h' },
              { value: 120, label: '2h' },
              { value: 180, label: '3h' },
            ]}
            value={form.duration}
            onChange={(d) => setForm((f) => ({ ...f, duration: d }))}
          />
        </div>

        {/* Gender Mode */}
        <div>
          <label className="label">Player Mix</label>
          <SegmentedControl
            ariaLabel="Player mix"
            options={[
              { value: 'mixed', label: '🚺🚹 Mixed' },
              { value: 'same_gender', label: '👥 Same Gender' },
            ]}
            value={form.genderMode}
            onChange={(val) => setForm((f) => ({ ...f, genderMode: val }))}
          />
          {form.genderMode === 'mixed' && (
            <p className="text-xs text-lob-muted-light mt-1">
              Schedule will balance gender per court and keep left-handed players on opposite teams
            </p>
          )}
        </div>

        {/* Courts list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Courts</label>
            <button
              type="button"
              onClick={addCourt}
              className="text-xs text-lob-teal font-semibold flex items-center gap-1"
            >
              <Plus size={13} /> Add court
            </button>
          </div>
          <div className="space-y-2">
            {form.courts.map((c, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1 py-2 text-sm"
                    placeholder={`Court ${i + 1} name`}
                    value={c.name}
                    onChange={(e) => setCourt(i, 'name', e.target.value)}
                  />
                  {form.courts.length > 1 && (
                    <button type="button" onClick={() => removeCourt(i)}>
                      <X size={16} className="text-lob-muted-light" />
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-lob-slate cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.booked}
                    onChange={(e) => setCourt(i, 'booked', e.target.checked)}
                    className="w-4 h-4 accent-lob-teal"
                  />
                  Court confirmed / booked
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div>
          <label className="label">Price per Person (€)</label>
          <p className="text-xs text-lob-muted mb-2">
            All-in amount per player covering courts, food, drinks and prizes.
          </p>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input"
            placeholder="e.g. 35"
            value={form.pricePerPerson}
            onChange={(e) => setForm((f) => ({ ...f, pricePerPerson: e.target.value }))}
          />
          {form.pricePerPerson && parseInt(String(form.maxPlayers)) > 0 && (
            <p className="text-sm font-semibold text-lob-teal mt-1.5">
              {form.maxPlayers} players × {fmtEur(form.pricePerPerson)} ={' '}
              {fmtEur(
                (parseFloat(String(form.pricePerPerson)) || 0) *
                  (parseInt(String(form.maxPlayers)) || 0),
              )}
              <span className="text-xs font-normal text-lob-muted-light"> total</span>
            </p>
          )}
        </div>

        {/* Tikkie link */}
        <div>
          <label className="label">Tikkie Link (optional)</label>
          <p className="text-xs text-lob-muted mb-2">
            Paste your Tikkie link here so players can pay directly from the registration page.
          </p>
          <input
            className="input"
            placeholder="https://tikkie.me/pay/..."
            value={form.tikkieLink}
            onChange={(e) => setForm((f) => ({ ...f, tikkieLink: e.target.value }))}
          />
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <p className="text-xs text-lob-muted mb-2">
            Shown to players on the home screen and event page. Feel free to edit — the default
            covers check-in, what's included, and pairings.
          </p>
          <textarea
            className="input resize-none"
            rows={5}
            placeholder="What should players know about this event?"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </form>
    </Modal>
  )
}
