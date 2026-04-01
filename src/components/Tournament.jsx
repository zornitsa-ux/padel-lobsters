import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  Plus, X, Trash2, Pencil, Trophy,
  MapPin, Calendar, Users, Euro, CheckCircle, Circle,
  Building2, ShieldCheck, UserCog
} from 'lucide-react'
import AdminLogin from './AdminLogin'

const emptyForm = {
  name: '',
  date: '',
  time: '',
  location: '',
  maxPlayers: '16',
  format: 'americano',
  courtBookingMode: 'admin_all',
  courts: [{ name: '', booked: false, costPerPerson: '', responsible: '' }],
  totalPrice: '',
  notes: '',
}

export default function Tournament({ onNavigate }) {
  const { tournaments, addTournament, updateTournament, deleteTournament, isAdmin } = useApp()
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState(null)
  const [form, setForm]           = useState(emptyForm)
  const [saving, setSaving]       = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  const openAdd = () => {
    if (!isAdmin) { setShowLogin(true); return }
    setForm(emptyForm); setEditId(null); setShowForm(true)
  }

  const openEdit = (t) => {
    if (!isAdmin) { setShowLogin(true); return }
    setForm({
      name:             t.name             || '',
      date:             t.date             || '',
      time:             t.time             || '',
      location:         t.location         || '',
      maxPlayers:       t.maxPlayers       || '16',
      format:           t.format           || 'americano',
      courtBookingMode: t.courtBookingMode || 'admin_all',
      courts: t.courts?.length
        ? t.courts.map(c => ({ name: c.name || '', booked: !!c.booked, costPerPerson: c.costPerPerson || '', responsible: c.responsible || '' }))
        : [{ name: '', booked: false, costPerPerson: '', responsible: '' }],
      totalPrice: t.totalPrice ?? '',
      notes:      t.notes      || '',
    })
    setEditId(t.id); setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!isAdmin) { setShowLogin(true); return }
    if (!confirm('Delete this event?')) return
    await deleteTournament(id)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const mp = parseInt(form.maxPlayers) || 16
      const data = {
        name:             form.name,
        date:             form.date,
        time:             form.time,
        location:         form.location,
        maxPlayers:       mp,
        format:           form.format,
        courtBookingMode: form.courtBookingMode,
        totalPrice:       form.courtBookingMode === 'admin_all' ? (parseFloat(form.totalPrice) || 0) : 0,
        courts: form.courts.map(c => ({
          name:          c.name,
          booked:        !!c.booked,
          costPerPerson: form.courtBookingMode === 'player_responsible' ? (parseFloat(c.costPerPerson) || 0) : 0,
          responsible:   form.courtBookingMode === 'player_responsible' ? (c.responsible || '') : '',
        })),
        notes: form.notes,
      }
      if (editId) await updateTournament(editId, data)
      else        await addTournament(data)
      setShowForm(false)
    } finally { setSaving(false) }
  }

  const addCourt = () => setForm(f => ({
    ...f, courts: [...f.courts, { name: '', booked: false, costPerPerson: '', responsible: '' }]
  }))

  const removeCourt = (i) => setForm(f => ({
    ...f, courts: f.courts.filter((_, idx) => idx !== i)
  }))

  const setCourt = (i, field, value) => setForm(f => ({
    ...f,
    courts: f.courts.map((c, idx) => idx === i ? { ...c, [field]: value } : c)
  }))

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatLabel = (f) => ({
    americano:       'Americano',
    mexicano:        'Mexicano',
    roundrobin:      'Round Robin',
    knockout:        'Knockout',
    lobster_matching:'Lobster Matching',
  }[f] || f)

  // Price display helpers
  const pricePerPlayer = (t) => {
    if (t.courtBookingMode === 'admin_all' || !t.courtBookingMode) {
      const tp = parseFloat(t.totalPrice) || 0
      const mp = parseInt(t.maxPlayers)   || 16
      return tp > 0 ? tp / mp : 0
    }
    return (t.courts || []).reduce((sum, c) => sum + (parseFloat(c.costPerPerson) || 0), 0)
  }

  return (
    <div className="space-y-4">
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Events ({tournaments.length})</h2>
        <button onClick={openAdd} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
          <Plus size={16} /> New
        </button>
      </div>

      {/* Tournament list */}
      <div className="space-y-3">
        {tournaments.length === 0 && (
          <div className="card py-10 text-center text-gray-400">
            <Trophy size={36} className="mx-auto mb-2 opacity-30" />
            <p>No events yet. Create your first one!</p>
          </div>
        )}

        {tournaments.map(t => {
          const allBooked    = (t.courts || []).every(c => c.booked)
          const bookedCount  = (t.courts || []).filter(c => c.booked).length
          const totalCourts  = (t.courts || []).length
          const ppCost       = pricePerPlayer(t)
          const isAdminAll   = !t.courtBookingMode || t.courtBookingMode === 'admin_all'

          return (
            <div key={t.id} className="card">
              {/* Header row */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-lobster-cream rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={22} className="text-lobster-teal" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-800 truncate">{t.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar size={11} /> {formatDate(t.date)} {t.time && `· ${t.time}`}
                  </p>
                  {t.location && (
                    <p className="text-xs text-lobster-teal flex items-center gap-1 mt-0.5">
                      <Building2 size={11} /> {t.location}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  t.status === 'completed' ? 'bg-gray-100 text-gray-500'
                  : t.status === 'active'  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
                }`}>
                  {t.status}
                </span>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <InfoChip icon={<Users size={12} />} label={`${t.maxPlayers || '?'} players`} />
                <InfoChip icon={<MapPin size={12} />} label={`${bookedCount}/${totalCourts} courts`} warn={!allBooked && totalCourts > 0} />
                <InfoChip icon={<Euro size={12} />} label={ppCost > 0 ? `€${ppCost.toFixed(2)}/pp` : 'No cost'} />
              </div>

              {/* Booking mode badge */}
              <div className="mb-2">
                {isAdminAll
                  ? <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                      <ShieldCheck size={11} /> Admin books all courts
                    </span>
                  : <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                      <UserCog size={11} /> Players responsible per court
                    </span>
                }
                {isAdminAll && (t.totalPrice > 0) && (
                  <span className="ml-2 text-xs text-gray-500">
                    Total €{parseFloat(t.totalPrice).toFixed(2)} incl. courts + food + prizes
                  </span>
                )}
              </div>

              {/* Courts */}
              {(t.courts || []).length > 0 && (
                <div className="space-y-1 mb-3">
                  {t.courts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {c.booked
                        ? <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                        : <Circle size={14} className="text-gray-300 flex-shrink-0" />
                      }
                      <span className="flex-1 text-gray-700">{c.name || `Court ${i + 1}`}</span>
                      {!isAdminAll && c.responsible && (
                        <span className="text-xs text-purple-600 font-medium">{c.responsible}</span>
                      )}
                      {!isAdminAll && c.costPerPerson > 0 && (
                        <span className="text-xs text-gray-500">€{c.costPerPerson}/pp</span>
                      )}
                      {isAdmin && !c.booked && (
                        <button
                          onClick={() => {
                            const courts = [...(t.courts || [])]
                            courts[i] = { ...courts[i], booked: true }
                            updateTournament(t.id, { courts })
                          }}
                          className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold"
                        >
                          Mark booked
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Format chip */}
              <p className="text-xs text-gray-400 mb-3">Format: <span className="font-medium text-gray-600">{formatLabel(t.format)}</span></p>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => onNavigate('registration', t)} className="flex-1 text-xs font-semibold text-lobster-teal py-2 rounded-xl bg-lobster-cream active:scale-95 transition-all">
                  Registrations
                </button>
                <button onClick={() => onNavigate('payments', t)} className="flex-1 text-xs font-semibold text-lobster-orange py-2 rounded-xl bg-orange-50 active:scale-95 transition-all">
                  Payments
                </button>
                <button onClick={() => onNavigate('schedule', t)} className="flex-1 text-xs font-semibold text-gray-600 py-2 rounded-xl bg-gray-100 active:scale-95 transition-all">
                  Schedule
                </button>
                {isAdmin && (
                  <>
                    <button onClick={() => openEdit(t)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:scale-95">
                      <Pencil size={14} className="text-gray-600" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 active:scale-95">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editId ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowForm(false)}><X size={22} className="text-gray-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">

              {/* Event name */}
              <div>
                <label className="label">Event Name *</label>
                <input required className="input" placeholder="e.g. Lobsters Americano #12"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Location */}
              <div>
                <label className="label">Location (Club / Venue)</label>
                <input className="input" placeholder="e.g. Padel City Amsterdam"
                  value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date *</label>
                  <input required type="date" className="input"
                    value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Time</label>
                  <input type="time" className="input"
                    value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>

              {/* Max players & Format */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Max Players</label>
                  <input type="number" min="4" max="64" step="4" className="input"
                    value={form.maxPlayers} onChange={e => setForm(f => ({ ...f, maxPlayers: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Format</label>
                  <select className="input" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                    <option value="americano">Americano</option>
                    <option value="mexicano">Mexicano</option>
                    <option value="lobster_matching">Lobster Matching</option>
                    <option value="roundrobin">Round Robin</option>
                    <option value="knockout">Knockout</option>
                  </select>
                </div>
              </div>

              {/* ── Court Booking Mode ── */}
              <div>
                <label className="label">Court Booking</label>
                <div className="space-y-2">

                  {/* Option 1: Admin books all */}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, courtBookingMode: 'admin_all' }))}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      form.courtBookingMode === 'admin_all'
                        ? 'border-lobster-teal bg-teal-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <ShieldCheck size={15} className={form.courtBookingMode === 'admin_all' ? 'text-lobster-teal' : 'text-gray-400'} />
                      <span className="font-semibold text-sm text-gray-800">Admin books all courts</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-5">
                      You book all courts centrally. One total price covers courts + food, drinks &amp; prizes — split equally among players.
                    </p>
                  </button>

                  {/* Option 2: Players responsible */}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, courtBookingMode: 'player_responsible' }))}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      form.courtBookingMode === 'player_responsible'
                        ? 'border-purple-400 bg-purple-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <UserCog size={15} className={form.courtBookingMode === 'player_responsible' ? 'text-purple-600' : 'text-gray-400'} />
                      <span className="font-semibold text-sm text-gray-800">Players help book courts</span>
                    </div>
                    <p className="text-xs text-gray-500 ml-5">
                      Each court has a responsible player who books it on Playtomic. Set a cost per person per court.
                    </p>
                  </button>
                </div>
              </div>

              {/* ── Courts list ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Courts</label>
                  <button type="button" onClick={addCourt}
                    className="text-xs text-lobster-teal font-semibold flex items-center gap-1">
                    <Plus size={13} /> Add court
                  </button>
                </div>
                <div className="space-y-2">
                  {form.courts.map((c, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                      {/* Court name + remove button */}
                      <div className="flex items-center gap-2">
                        <input className="input flex-1 py-2 text-sm" placeholder={`Court ${i + 1} name`}
                          value={c.name} onChange={e => setCourt(i, 'name', e.target.value)} />
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
                            type="number" min="0" step="0.5"
                            placeholder="€ cost per person for this court"
                            value={c.costPerPerson}
                            onChange={e => setCourt(i, 'costPerPerson', e.target.value)}
                          />
                          <input
                            className="input py-2 text-sm w-full"
                            placeholder="Responsible player name (books on Playtomic)"
                            value={c.responsible}
                            onChange={e => setCourt(i, 'responsible', e.target.value)}
                          />
                        </div>
                      )}

                      {/* Booked checkbox */}
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={c.booked}
                          onChange={e => setCourt(i, 'booked', e.target.checked)}
                          className="w-4 h-4 accent-lobster-teal" />
                        Court confirmed / booked
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Pricing ── */}
              {form.courtBookingMode === 'admin_all' && (
                <div>
                  <label className="label">Total Event Price (€)</label>
                  <p className="text-xs text-gray-500 mb-2">
                    All-in amount covering courts, food, drinks and prizes. Will be split equally among all registered players.
                  </p>
                  <input
                    type="number" min="0" step="0.5" className="input"
                    placeholder="e.g. 320"
                    value={form.totalPrice}
                    onChange={e => setForm(f => ({ ...f, totalPrice: e.target.value }))}
                  />
                  {form.totalPrice && parseInt(form.maxPlayers) > 0 && (
                    <p className="text-sm font-semibold text-lobster-teal mt-1.5">
                      = €{(parseFloat(form.totalPrice) / parseInt(form.maxPlayers)).toFixed(2)} per player
                      <span className="text-xs font-normal text-gray-400"> (based on {form.maxPlayers} players)</span>
                    </p>
                  )}
                </div>
              )}

              {form.courtBookingMode === 'player_responsible' && form.courts.length > 0 && (
                <p className="text-xs text-gray-500">
                  Total per player: <span className="font-semibold text-gray-700">
                    €{form.courts.reduce((s, c) => s + (parseFloat(c.costPerPerson) || 0), 0).toFixed(2)}
                  </span>
                </p>
              )}

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} placeholder="Parking, dress code, anything else..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Event'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoChip({ icon, label, warn }) {
  return (
    <div className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1.5 ${warn ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-600'}`}>
      {icon}
      <span className="font-medium truncate">{label}</span>
    </div>
  )
}
