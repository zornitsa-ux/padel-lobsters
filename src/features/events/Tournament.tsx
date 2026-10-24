import React, { useCallback, useState, type FormEvent } from 'react'
import { useApp } from '../../context/useApp'
import { useTournaments, useUpdateTournament, useDeleteTournament } from './useTournaments'
import { useTransfers } from './useTransfers'
import { useEventForm } from './useEventForm'
import { Plus, Trophy, Clock } from 'lucide-react'
import HistoryContent from '../history/History'
import AdminTransferPanel from '../../components/AdminTransferPanel'
import { DEFAULT_EVENT_DESCRIPTION } from './eventConstants'
import { parseLocalDate } from './eventHelpers'
import EventFormModal from './EventFormModal'
import UpcomingEventCard from './UpcomingEventCard'
import { EventCard } from './EventCard'
import { LeagueDashboardCard } from '../league/ui/LeagueDashboardCard'
import { PageHeader } from '../../components/ui/PageHeader'
import { CollapsibleSection } from '../../components/ui/CollapsibleSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { errorMessage, errorCode, FOREIGN_KEY_VIOLATION } from '../../lib/errors'
import { useConfirm } from '../../lib/confirmBus'
import type { EventNavigate } from './eventHelpers'
import type { NormalisedTournament } from '../../lib/normalise'
import type { TournamentInput } from './tournamentQueries'

export { DEFAULT_EVENT_DESCRIPTION }

export default function Tournament({ onNavigate }: { onNavigate: EventNavigate }) {
  const confirm = useConfirm()
  const { session, isAdmin } = useApp()
  const { data: tournaments = [] } = useTournaments()
  const { data: transfers = [] } = useTransfers()
  const updateMut = useUpdateTournament()
  const deleteMut = useDeleteTournament()
  const updateTournament = useCallback(
    (id: string, data: TournamentInput) => updateMut.mutateAsync({ id, data }),
    [updateMut],
  )
  const deleteTournament = useCallback((id: string) => deleteMut.mutateAsync(id), [deleteMut])
  const claimedId = session?.user?.id ?? null

  const eventForm = useEventForm()
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
    eventForm.openNew()
  }

  const openEdit = (t: NormalisedTournament) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    eventForm.openEdit(t)
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

  // A format refused by the server is put back and locked by the hook; the
  // picker's lock note says why.
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    try {
      await eventForm.save()
    } catch (err) {
      setError(errorMessage(err, 'Could not save event.'))
    }
  }

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
          <div className="space-y-2">
            {past.map((t) => (
              <EventCard key={t.id} tournament={t} past />
            ))}

            {/* Legacy History Records */}
            <div className="mt-4">
              <HistoryContent onNavigate={onNavigate} />
            </div>
          </div>
        </CollapsibleSection>

        <EventFormModal {...eventForm.modalProps} onSubmit={(e) => void handleSubmit(e)} />
      </div>
    </div>
  )
}
