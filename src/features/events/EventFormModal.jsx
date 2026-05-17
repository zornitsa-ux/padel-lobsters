import React from 'react'
import { Plus, X, ShieldCheck, UserCog } from 'lucide-react'
import { fmtEur } from '../../lib/format'

export default function EventFormModal({
  editId,
  form,
  setForm,
  saving,
  onSubmit,
  onClose,
  addCourt,
  removeCourt,
  setCourt,
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">{editId ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-5">
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

          {/* Max players & Format */}
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="label">Format</label>
              <select
                className="input"
                value={form.format}
                onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
              >
                <option value="americano">Americano</option>
                <option value="mexicano">Mexicano</option>
                <option value="lobster_matching">Lobster Matching</option>
                <option value="roundrobin">Round Robin</option>
                <option value="knockout">Knockout</option>
              </select>
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="label">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[60, 90, 120, 180].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, duration: d }))}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    form.duration === d ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {d < 60 ? `${d}m` : d === 60 ? '1h' : d === 90 ? '1.5h' : d === 120 ? '2h' : '3h'}
                </button>
              ))}
            </div>
          </div>

          {/* ── Gender Mode ── */}
          <div>
            <label className="label">Player Mix</label>
            <div className="flex gap-2">
              {[
                ['mixed', '🚺🚹 Mixed'],
                ['same_gender', '👥 Same Gender'],
              ].map(([val, lbl]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setForm((f) => ({ ...f, genderMode: val }))}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    form.genderMode === val
                      ? 'bg-lobster-teal text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {form.genderMode === 'mixed' && (
              <p className="text-xs text-gray-400 mt-1">
                Schedule will balance gender per court and keep left-handed players on opposite
                teams
              </p>
            )}
          </div>

          {/* ── Court Booking Mode ── */}
          <div>
            <label className="label">Court Booking</label>
            <div className="space-y-2">
              {/* Option 1: Admin books all */}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, courtBookingMode: 'admin_all' }))}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  form.courtBookingMode === 'admin_all'
                    ? 'border-lobster-teal bg-teal-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <ShieldCheck
                    size={15}
                    className={
                      form.courtBookingMode === 'admin_all' ? 'text-lobster-teal' : 'text-gray-400'
                    }
                  />
                  <span className="font-semibold text-sm text-gray-800">
                    Admin books all courts
                  </span>
                </div>
                <p className="text-xs text-gray-500 ml-5">
                  You book all courts centrally. One total price covers courts + food, drinks &amp;
                  prizes — split equally among players.
                </p>
              </button>

              {/* Option 2: Players responsible */}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, courtBookingMode: 'player_responsible' }))}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  form.courtBookingMode === 'player_responsible'
                    ? 'border-purple-400 bg-purple-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <UserCog
                    size={15}
                    className={
                      form.courtBookingMode === 'player_responsible'
                        ? 'text-purple-600'
                        : 'text-gray-400'
                    }
                  />
                  <span className="font-semibold text-sm text-gray-800">
                    Players help book courts
                  </span>
                </div>
                <p className="text-xs text-gray-500 ml-5">
                  Each court has a responsible player who books it on Playtomic. Set a cost per
                  person per court.
                </p>
              </button>
            </div>
          </div>

          {/* ── Courts list ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Courts</label>
              <button
                type="button"
                onClick={addCourt}
                className="text-xs text-lobster-teal font-semibold flex items-center gap-1"
              >
                <Plus size={13} /> Add court
              </button>
            </div>
            <div className="space-y-2">
              {form.courts.map((c, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  {/* Court name + remove button */}
                  <div className="flex items-center gap-2">
                    <input
                      className="input flex-1 py-2 text-sm"
                      placeholder={`Court ${i + 1} name`}
                      value={c.name}
                      onChange={(e) => setCourt(i, 'name', e.target.value)}
                    />
                    {form.courts.length > 1 && (
                      <button type="button" onClick={() => removeCourt(i)}>
                        <X size={16} className="text-gray-400" />
                      </button>
                    )}
                  </div>

                  {/* Player-responsible mode extras */}
                  {form.courtBookingMode === 'player_responsible' && (
                    <div className="space-y-2">
                      <input
                        className="input py-2 text-sm w-full"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="€ cost per person for this court"
                        value={c.costPerPerson}
                        onChange={(e) => setCourt(i, 'costPerPerson', e.target.value)}
                      />
                      <input
                        className="input py-2 text-sm w-full"
                        placeholder="Responsible player name (books on Playtomic)"
                        value={c.responsible}
                        onChange={(e) => setCourt(i, 'responsible', e.target.value)}
                      />
                      <input
                        className="input py-2 text-sm w-full"
                        placeholder="Tikkie link for this court (optional)"
                        value={c.tikkieLink}
                        onChange={(e) => setCourt(i, 'tikkieLink', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Booked checkbox */}
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={c.booked}
                      onChange={(e) => setCourt(i, 'booked', e.target.checked)}
                      className="w-4 h-4 accent-lobster-teal"
                    />
                    Court confirmed / booked
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pricing ── */}
          {form.courtBookingMode === 'admin_all' && (
            <div>
              <label className="label">Price per Person (€)</label>
              <p className="text-xs text-gray-500 mb-2">
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
              {form.pricePerPerson && parseInt(form.maxPlayers) > 0 && (
                <p className="text-sm font-semibold text-lobster-teal mt-1.5">
                  {form.maxPlayers} players × {fmtEur(form.pricePerPerson)} ={' '}
                  {fmtEur(
                    (parseFloat(form.pricePerPerson) || 0) * (parseInt(form.maxPlayers) || 0),
                  )}
                  <span className="text-xs font-normal text-gray-400"> total</span>
                </p>
              )}
            </div>
          )}

          {form.courtBookingMode === 'player_responsible' && form.courts.length > 0 && (
            <p className="text-xs text-gray-500">
              Total per player:{' '}
              <span className="font-semibold text-gray-700">
                {fmtEur(form.courts.reduce((s, c) => s + (parseFloat(c.costPerPerson) || 0), 0))}
              </span>
            </p>
          )}

          {/* Tikkie link — admin_all only */}
          {form.courtBookingMode === 'admin_all' && (
            <div>
              <label className="label">Tikkie Link (optional)</label>
              <p className="text-xs text-gray-500 mb-2">
                Paste your Tikkie link here so players can pay directly from the registration page.
              </p>
              <input
                className="input"
                placeholder="https://tikkie.me/pay/..."
                value={form.tikkieLink}
                onChange={(e) => setForm((f) => ({ ...f, tikkieLink: e.target.value }))}
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <p className="text-xs text-gray-500 mb-2">
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

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Event'}
          </button>
        </form>
      </div>
    </div>
  )
}
