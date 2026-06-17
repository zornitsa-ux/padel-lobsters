import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { usePlayers } from '../players/usePlayers'
import { Plus, Trophy, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import HistoryContent from '../../components/History'
import { TOURNAMENTS as HISTORY_TOURNAMENTS } from '../../data/historicalTournaments'
import AdminTransferPanel from '../../components/AdminTransferPanel'
import { DEFAULT_EVENT_DESCRIPTION, emptyForm } from './eventConstants'
import { parseLocalDate } from './eventHelpers'
import EventFormModal from './EventFormModal'
import UpcomingEventCard from './UpcomingEventCard'
import PastEventCard from './PastEventCard'
import { LeagueDashboardCard } from '../league/ui/LeagueDashboardCard'

export { DEFAULT_EVENT_DESCRIPTION }

export default function Tournament({ onNavigate }) {
  const { tournaments, addTournament, updateTournament, deleteTournament, session, transfers } =
    useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  const meTourn = claimedId ? players.find((p) => String(p.id) === String(claimedId)) : null
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [error, setError] = useState('')
  // Admin pending-transfer panel — open for one tournament at a time.
  const [adminTransferTournament, setAdminTransferTournament] = useState(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Once a completed event is >= 2 days past its date, the embedded
  // <HistoryContent /> renders it as a podium card, so don't also list it
  // here as a past-event card — that's what produced the duplicate render.
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
  const isInHistory = (t) => {
    if (t.status !== 'completed') return false
    const ref = t.date || t.completedAt
    if (!ref) return true
    return Date.now() - new Date(ref).getTime() >= TWO_DAYS_MS
  }
  const past = tournaments.filter((t) => {
    if (isInHistory(t)) return false
    if (t.status === 'completed') return true
    const d = parseLocalDate(t.date)
    return d !== null && d < today
  })
  const upcoming = tournaments.filter((t) => {
    if (t.status === 'completed') return false
    const d = parseLocalDate(t.date)
    return d === null || d >= today
  })

  const openAdd = () => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setForm(emptyForm)
    setEditId(null)
    setShowForm(true)
  }

  const openEdit = (t) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setForm({
      name: t.name || '',
      date: t.date || '',
      time: t.time || '',
      location: t.location || '',
      maxPlayers: t.maxPlayers || '16',
      duration: t.duration || 90,
      format: t.format || 'americano',
      genderMode: t.genderMode || 'mixed',
      courtBookingMode: t.courtBookingMode || 'admin_all',
      courts: t.courts?.length
        ? t.courts.map((c) => ({
            name: c.name || '',
            booked: !!c.booked,
            costPerPerson: c.costPerPerson || '',
            responsible: c.responsible || '',
            tikkieLink: c.tikkieLink || '',
          }))
        : [{ name: '', booked: false, costPerPerson: '', responsible: '', tikkieLink: '' }],
      pricePerPerson:
        parseFloat(t.totalPrice) > 0 && parseInt(t.maxPlayers) > 0
          ? (parseFloat(t.totalPrice) / parseInt(t.maxPlayers)).toFixed(2).replace(/\.00$/, '')
          : (t.totalPrice ?? ''),
      tikkieLink: t.tikkieLink || '',
      notes: t.notes || '',
    })
    setEditId(t.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (!confirm('Delete this event?')) return
    setError('')
    try {
      await deleteTournament(id)
    } catch (err) {
      setError(err?.message || 'Could not delete event.')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const mp = parseInt(form.maxPlayers) || 16
      const data = {
        name: form.name,
        date: form.date,
        time: form.time,
        location: form.location,
        maxPlayers: mp,
        format: form.format,
        genderMode: form.genderMode,
        courtBookingMode: form.courtBookingMode,
        duration: parseInt(form.duration) || 90,
        totalPrice:
          form.courtBookingMode === 'admin_all'
            ? (parseFloat(form.pricePerPerson) || 0) * (parseInt(form.maxPlayers) || 16)
            : 0,
        tikkieLink: form.courtBookingMode === 'admin_all' ? form.tikkieLink || '' : '',
        courts: form.courts.map((c) => ({
          name: c.name,
          booked: !!c.booked,
          costPerPerson:
            form.courtBookingMode === 'player_responsible' ? parseFloat(c.costPerPerson) || 0 : 0,
          responsible: form.courtBookingMode === 'player_responsible' ? c.responsible || '' : '',
          tikkieLink: form.courtBookingMode === 'player_responsible' ? c.tikkieLink || '' : '',
        })),
        notes: form.notes,
      }
      try {
        if (editId) await updateTournament(editId, data)
        else await addTournament(data)
        setShowForm(false)
      } catch (err) {
        setError(err?.message || 'Could not save event.')
      }
    } finally {
      setSaving(false)
    }
  }

  const addCourt = () =>
    setForm((f) => ({
      ...f,
      courts: [
        ...f.courts,
        { name: '', booked: false, costPerPerson: '', responsible: '', tikkieLink: '' },
      ],
    }))

  const removeCourt = (i) =>
    setForm((f) => ({
      ...f,
      courts: f.courts.filter((_, idx) => idx !== i),
    }))

  const setCourt = (i, field, value) =>
    setForm((f) => ({
      ...f,
      courts: f.courts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    }))

  return (
    <div className="space-y-4">
      {adminTransferTournament && (
        <AdminTransferPanel
          tournament={adminTransferTournament}
          onClose={() => setAdminTransferTournament(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Events ({tournaments.length})</h2>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5"
          >
            <Plus size={16} /> New
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="text-red-500 font-bold leading-none px-1"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <LeagueDashboardCard myPlayerId={claimedId} />

      {/* Upcoming events */}
      <div className="space-y-3">
        {upcoming.length === 0 && (
          <div className="card py-10 text-center text-gray-400">
            <Trophy size={36} className="mx-auto mb-2 opacity-30" />
            <p>No upcoming events. Create your first one!</p>
          </div>
        )}

        {upcoming.map((t) => (
          <UpcomingEventCard
            key={t.id}
            t={t}
            isAdmin={isAdmin}
            transfers={transfers}
            onNavigate={onNavigate}
            onEdit={openEdit}
            onDelete={handleDelete}
            onOpenTransfers={setAdminTransferTournament}
            updateTournament={updateTournament}
          />
        ))}
      </div>

      {/* Past events + History — collapsible */}
      <div>
        <button
          onClick={() => setShowHistory((h) => !h)}
          className="w-full flex items-center justify-between py-3 px-1 text-gray-500 font-semibold text-sm"
        >
          <span className="flex items-center gap-2">
            <Clock size={15} className="text-gray-400" />
            Past Events & History ({past.length + HISTORY_TOURNAMENTS.length})
          </span>
          {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showHistory && (
          <div className="space-y-3">
            {past.map((t) => (
              <PastEventCard
                key={t.id}
                t={t}
                isAdmin={isAdmin}
                onNavigate={onNavigate}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}

            {/* Legacy History Records */}
            <div className="mt-4">
              <HistoryContent onNavigate={onNavigate} />
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <EventFormModal
          editId={editId}
          form={form}
          setForm={setForm}
          saving={saving}
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
          addCourt={addCourt}
          removeCourt={removeCourt}
          setCourt={setCourt}
        />
      )}
    </div>
  )
}
