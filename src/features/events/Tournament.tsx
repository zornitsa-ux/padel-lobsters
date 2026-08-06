import React, { useCallback, useState, type FormEvent } from 'react'
import { useApp } from '../../context/useApp'
import {
  useTournaments,
  useAddTournament,
  useUpdateTournament,
  useDeleteTournament,
} from './useTournaments'
import { useTransfers } from './useTransfers'
import { Plus, Trophy, Clock } from 'lucide-react'
import HistoryContent from '../history/History'
import AdminTransferPanel from '../../components/AdminTransferPanel'
import { DEFAULT_EVENT_DESCRIPTION, emptyForm } from './eventConstants'
import { parseLocalDate } from './eventHelpers'
import EventFormModal from './EventFormModal'
import UpcomingEventCard from './UpcomingEventCard'
import PastEventCard from './PastEventCard'
import { LeagueDashboardCard } from '../league/ui/LeagueDashboardCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { CollapsibleSection } from '../../components/ui/CollapsibleSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { errorMessage, errorCode, FOREIGN_KEY_VIOLATION } from '../../lib/errors'
import { useConfirm } from '../../lib/confirmBus'
import type { EventNavigate } from './eventHelpers'
import type { NormalisedTournament } from '../../lib/normalise'
import type { SetEventFormCourt } from './EventFormModal'

export { DEFAULT_EVENT_DESCRIPTION }

export default function Tournament({ onNavigate }: { onNavigate: EventNavigate }) {
  const confirm = useConfirm()
  const { session } = useApp()
  const { data: tournaments = [] } = useTournaments()
  const { data: transfers = [] } = useTransfers()
  const addMut = useAddTournament()
  const updateMut = useUpdateTournament()
  const deleteMut = useDeleteTournament()
  const addTournament = useCallback(
    (data: Partial<NormalisedTournament>) => addMut.mutateAsync(data),
    [addMut],
  )
  const updateTournament = useCallback(
    (id: string, data: Partial<NormalisedTournament>) => updateMut.mutateAsync({ id, data }),
    [updateMut],
  )
  const deleteTournament = useCallback((id: string) => deleteMut.mutateAsync(id), [deleteMut])
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [error, setError] = useState('')
  // Admin pending-transfer panel — open for one tournament at a time.
  const [adminTransferTournament, setAdminTransferTournament] =
    useState<NormalisedTournament | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Once a completed event is >= 2 days past its date, the embedded
  // <HistoryContent /> renders it as a podium card, so don't also list it
  // here as a past-event card — that's what produced the duplicate render.
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
  const isInHistory = (t: NormalisedTournament) => {
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

  const openEdit = (t: NormalisedTournament) => {
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
      format: t.format || 'lobster_matching',
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
        parseFloat(String(t.totalPrice)) > 0 && parseInt(String(t.maxPlayers)) > 0
          ? (parseFloat(String(t.totalPrice)) / parseInt(String(t.maxPlayers)))
              .toFixed(2)
              .replace(/\.00$/, '')
          : (t.totalPrice ?? ''),
      tikkieLink: t.tikkieLink || '',
      notes: t.notes || '',
    })
    setEditId(t.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (!(await confirm({ message: 'Delete this event?', destructive: true }))) return
    setError('')
    try {
      await deleteTournament(id)
    } catch (err) {
      // registrations.tournament_id is ON DELETE RESTRICT (20260806211102), so
      // an event anyone ever signed up for can't be removed — cancelled rows
      // count, since registrations are never hard-deleted. Without this the
      // admin gets the raw constraint sentence.
      setError(
        errorCode(err) === FOREIGN_KEY_VIOLATION
          ? "This event has sign-up history, so it can't be deleted. That history is kept on purpose — mark the event completed instead."
          : errorMessage(err, 'Could not delete event.'),
      )
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const mp = parseInt(String(form.maxPlayers)) || 16
      const data = {
        name: form.name,
        date: form.date,
        time: form.time,
        location: form.location,
        maxPlayers: mp,
        format: form.format,
        genderMode: form.genderMode,
        courtBookingMode: form.courtBookingMode,
        duration: parseInt(String(form.duration)) || 90,
        totalPrice:
          form.courtBookingMode === 'admin_all'
            ? (parseFloat(String(form.pricePerPerson)) || 0) *
              (parseInt(String(form.maxPlayers)) || 16)
            : 0,
        tikkieLink: form.courtBookingMode === 'admin_all' ? form.tikkieLink || '' : '',
        courts: form.courts.map((c) => ({
          name: c.name,
          booked: !!c.booked,
          costPerPerson:
            form.courtBookingMode === 'player_responsible'
              ? parseFloat(String(c.costPerPerson)) || 0
              : 0,
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
        setError(errorMessage(err, 'Could not save event.'))
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

  const removeCourt = (i: number) =>
    setForm((f) => ({
      ...f,
      courts: f.courts.filter((_, idx) => idx !== i),
    }))

  const setCourt: SetEventFormCourt = (i, field, value) =>
    setForm((f) => ({
      ...f,
      courts: f.courts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    }))

  return (
    <div className="-mx-4">
      <PageHeader
        title="Events"
        rightAction={
          isAdmin ? (
            <button
              onClick={openAdd}
              className="btn-secondary py-2 px-4 text-sm flex items-center gap-1.5"
            >
              <Plus size={16} /> New
            </button>
          ) : undefined
        }
      />

      <div className="px-4 pt-4 space-y-4">
        {adminTransferTournament && (
          <AdminTransferPanel
            tournament={adminTransferTournament}
            onClose={() => setAdminTransferTournament(null)}
          />
        )}

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
            <EmptyState
              icon={<Trophy size={36} />}
              title="No upcoming events. Create your first one!"
            />
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
        <CollapsibleSection
          title="Past"
          icon={<Clock size={13} className="text-lob-muted opacity-60" />}
          expanded={showHistory}
          onToggle={() => setShowHistory((h) => !h)}
        >
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
        </CollapsibleSection>

        <EventFormModal
          open={showForm}
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
      </div>
    </div>
  )
}
