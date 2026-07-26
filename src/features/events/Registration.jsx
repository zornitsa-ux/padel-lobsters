import React, { useCallback, useMemo, useState } from 'react'
import { useApp } from '../../context/useApp'
import { useUpdateTournament } from './useTournaments'
import { useTransfers, useTransferActions } from './useTransfers'
import { usePlayers } from '../players/usePlayers'
import { useMatches, useMatchActions } from './useMatches'
import { useRegistrations, useRegistrationActions } from './useRegistrations'
import { AlertCircle } from 'lucide-react'
import TransferSpotModal from '../../components/TransferSpotModal'
import TransferPendingModal from '../../components/TransferPendingModal'
import DateTile from '../../components/ui/DateTile'
import { EmptyState } from '../../components/ui/EmptyState'
import AddToCalendarButton from '../../components/ui/AddToCalendarButton'
import ShareWhatsAppButton from '../../components/ui/ShareWhatsAppButton'
import EventDescription from './EventDescription'
import EventAdminMenu from './EventAdminMenu'
import EventFormModal from './EventFormModal'
import { emptyForm } from './eventConstants'
import {
  splitRegistrationsByStatus,
  getAvailablePlayers,
  computePaymentConfig,
  formatEventDate,
  getPendingTransfersForTournament,
  getPendingFromPlayer,
  getIncomingForPlayer,
  buildPendingByFromPlayerId,
} from './registration/utils'
import { useTournamentResultsBanner } from './registration/useTournamentResultsBanner'
import RegistrationPaymentSheetModal from './registration/RegistrationPaymentSheetModal'
import AddPlayerCard from './registration/AddPlayerCard'
import MyRegistrationCard from './registration/MyRegistrationCard'
import RegisteredSection from './registration/RegisteredSection'
import WaitlistSection from './registration/WaitlistSection'
import CancelledSection from './registration/CancelledSection'
import ScoresAndRankingSection from './registration/ScoresAndRankingSection'
import { useScoreSync } from './useScoreSync'

export default function Registration({ tournament, onNavigate }) {
  const { session } = useApp()
  const { registerPlayer, updateRegistration, cancelRegistration } = useRegistrationActions()
  const { updateMatch } = useMatchActions()
  const { data: transfers = [] } = useTransfers()
  const { respondToTransfer, cancelTransfer } = useTransferActions({ session })
  const updateMut = useUpdateTournament()
  const updateTournament = useCallback(
    (id, data) => updateMut.mutateAsync({ id, data }),
    [updateMut],
  )
  const { data: players = [] } = usePlayers()
  const { data: regsData = [] } = useRegistrations(tournament?.id)
  const { data: matchesData = [] } = useMatches(tournament?.id)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  // Sync peer score updates while the tournament is active.
  // Disabled for completed events — scores are frozen.
  useScoreSync({
    tournamentId: tournament?.id,
    enabled: tournament != null && tournament.status !== 'completed',
  })

  // Show first name for players, full name for admins
  const displayName = useCallback(
    (p) => (isAdmin ? p.name : (p.name || '').split(' ')[0]),
    [isAdmin],
  )

  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [saving, setSaving] = useState(false)

  // Post-registration payment sheet
  const [paymentSheet, setPaymentSheet] = useState(null) // { regId, playerId, status }
  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring] = useState(false)

  const { showResultsBanner } = useTournamentResultsBanner({
    tournamentId: tournament?.id,
    tournamentDate: tournament?.date,
  })

  const openPaymentSheet = (sheet) => {
    setPaymentSheet(sheet)
    setTikkieClicked(false)
  }
  const closePaymentSheet = () => {
    setPaymentSheet(null)
    setTikkieClicked(false)
  }

  // Transfer flow modal state.
  //   pickerForReg : { reg } when the recipient picker is open
  //   shareModal   : { transferId, toPlayer } when the share-actions /
  //                  pending modal is open (after creating an offer or
  //                  via 'Resend WhatsApp' on a persistent pending banner)
  const [pickerForReg, setPickerForReg] = useState(null)
  const [shareModal, setShareModal] = useState(null)
  const [respondingTo, setRespondingTo] = useState(null) // transferId being acted on

  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editSaving, setEditSaving] = useState(false)

  const openEdit = useCallback(() => {
    const t = tournament
    setEditForm({
      name: t.name || '',
      date: t.date || '',
      time: t.time || '',
      location: t.location || '',
      maxPlayers: String(t.maxPlayers || 16),
      duration: t.duration || 90,
      format: t.format || 'lobster_matching',
      genderMode: t.genderMode || 'mixed',
      courtBookingMode: t.courtBookingMode || 'admin_all',
      courts: t.courts?.length
        ? t.courts.map((c) => ({
            name: c.name || '',
            booked: !!c.booked,
            costPerPerson: String(c.costPerPerson || ''),
            responsible: c.responsible || '',
            tikkieLink: c.tikkieLink || '',
          }))
        : [{ name: '', booked: false, costPerPerson: '', responsible: '', tikkieLink: '' }],
      pricePerPerson:
        t.totalPrice > 0 && t.maxPlayers > 0
          ? (t.totalPrice / t.maxPlayers).toFixed(2).replace(/\.00$/, '')
          : String(t.totalPrice ?? ''),
      tikkieLink: t.tikkieLink || '',
      notes: t.notes || '',
    })
    setShowEditForm(true)
  }, [tournament])

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditSaving(true)
    try {
      const mp = parseInt(editForm.maxPlayers) || 16
      const data = {
        name: editForm.name,
        date: editForm.date,
        time: editForm.time,
        location: editForm.location,
        maxPlayers: mp,
        format: editForm.format,
        genderMode: editForm.genderMode,
        courtBookingMode: editForm.courtBookingMode,
        duration: editForm.duration || 90,
        totalPrice:
          editForm.courtBookingMode === 'admin_all'
            ? (parseFloat(editForm.pricePerPerson) || 0) * mp
            : 0,
        tikkieLink: editForm.courtBookingMode === 'admin_all' ? editForm.tikkieLink || '' : '',
        courts: editForm.courts.map((c) => ({
          name: c.name,
          booked: !!c.booked,
          costPerPerson:
            editForm.courtBookingMode === 'player_responsible'
              ? parseFloat(c.costPerPerson) || 0
              : 0,
          responsible:
            editForm.courtBookingMode === 'player_responsible' ? c.responsible || '' : '',
          tikkieLink: editForm.courtBookingMode === 'player_responsible' ? c.tikkieLink || '' : '',
        })),
        notes: editForm.notes,
      }
      await updateTournament(tournament.id, data)
      setShowEditForm(false)
    } finally {
      setEditSaving(false)
    }
  }

  const addEditCourt = () =>
    setEditForm((f) => ({
      ...f,
      courts: [
        ...f.courts,
        { name: '', booked: false, costPerPerson: '', responsible: '', tikkieLink: '' },
      ],
    }))

  const removeEditCourt = (i) =>
    setEditForm((f) => ({ ...f, courts: f.courts.filter((_, idx) => idx !== i) }))

  const setEditCourt = (i, field, value) =>
    setEditForm((f) => ({
      ...f,
      courts: f.courts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)),
    }))

  const tournamentId = tournament?.id

  const regs = regsData
  const { registered, waitlisted, cancelled } = useMemo(
    () => splitRegistrationsByStatus(regs),
    [regs],
  )
  const availablePlayers = useMemo(
    () => getAvailablePlayers({ players, regs, search }),
    [players, regs, search],
  )

  const maxPlayers = tournament?.maxPlayers || 16
  const isCompleted = tournament?.status === 'completed'
  const { isAdminAll, hasTikkie, costPerPlayer } = useMemo(
    () => computePaymentConfig(tournament),
    [tournament],
  )

  const playerById = useMemo(() => {
    const map = new Map()
    for (const player of players) map.set(player.id, player)
    return map
  }, [players])
  const getPlayer = useCallback((id) => playerById.get(id), [playerById])

  const pendingForTournament = useMemo(() => {
    if (!tournamentId) return []
    return getPendingTransfersForTournament(transfers, tournamentId)
  }, [transfers, tournamentId])
  const pendingFromMe = useMemo(
    () => getPendingFromPlayer(pendingForTournament, claimedId),
    [pendingForTournament, claimedId],
  )
  const incomingForMe = useMemo(
    () => getIncomingForPlayer(pendingForTournament, claimedId),
    [pendingForTournament, claimedId],
  )
  const pendingByFromPlayerId = useMemo(
    () => buildPendingByFromPlayerId(pendingForTournament),
    [pendingForTournament],
  )

  const myReg = claimedId
    ? (registered.find((r) => String(r.playerId) === String(claimedId)) ?? null)
    : null
  const myWaitlistReg = claimedId
    ? (waitlisted.find((r) => String(r.playerId) === String(claimedId)) ?? null)
    : null
  const myWaitlistPosition = myWaitlistReg ? waitlisted.indexOf(myWaitlistReg) + 1 : null

  if (!tournament) {
    return (
      <EmptyState
        icon={<AlertCircle size={36} />}
        title="No event selected"
        action={
          <button
            onClick={() => onNavigate('tournament')}
            className="btn-primary mt-2 py-2 px-5 text-sm"
          >
            Go to Events
          </button>
        }
      />
    )
  }

  // ── Register ──────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!selectedPlayer) return
    setSaving(true)
    try {
      const { regId, status } = await registerPlayer(tournament.id, selectedPlayer, maxPlayers)
      // Only show payment sheet for directly-registered players (not waitlist),
      // and only if there's a Tikkie link or a cost set
      if (status === 'registered' && (hasTikkie || costPerPlayer > 0)) {
        openPaymentSheet({ regId, playerId: selectedPlayer, status })
      }
      setSelectedPlayer('')
      setShowAdd(false)
      setSearch('')
    } finally {
      setSaving(false)
    }
  }

  // ── Direct self-registration (used by MyRegistrationCard) ────────────────
  const handleSelfRegister = async () => {
    if (!claimedId) return
    setSaving(true)
    try {
      await registerPlayer(tournament.id, claimedId, maxPlayers)
    } finally {
      setSaving(false)
    }
  }

  // ── Self-declare payment by reg ID (used by MyRegistrationCard) ───────────
  const handleSelfDeclareById = async (regId) => {
    await updateRegistration(
      regId,
      { paymentStatus: 'pending_confirmation', paymentMethod: 'tikkie' },
      tournamentId,
    )
  }

  // ── Self-declare payment ──────────────────────────────────────────────────
  const handleSelfDeclare = async () => {
    if (!paymentSheet?.regId) return
    setDeclaring(true)
    await updateRegistration(
      paymentSheet.regId,
      { paymentStatus: 'pending_confirmation', paymentMethod: 'tikkie' },
      tournamentId,
    )
    setDeclaring(false)
    closePaymentSheet()
  }

  // ── Auto-mark "Tikkied" when a player taps a Tikkie link ──────────────────
  // Only upgrades from unpaid → tikkied. Never downgrades someone who already
  // self-declared "paid" or whom the admin already confirmed — even if they
  // re-open the Tikkie link (e.g. to check their payment history).
  const markTikkied = async (regId, currentStatus) => {
    if (!regId) return
    if (currentStatus && currentStatus !== 'unpaid') return
    try {
      await updateRegistration(
        regId,
        { paymentStatus: 'tikkied', paymentMethod: 'tikkie' },
        tournamentId,
      )
    } catch (err) {
      // Non-blocking — the Tikkie link still opens even if the status update
      // fails. Admin can always fix the status manually.
      console.warn('markTikkied failed', err)
    }
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async (reg) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (!confirm(`Cancel ${getPlayer(reg.playerId)?.name}'s registration?`)) return
    await cancelRegistration(reg.id, tournament.id)
  }

  const handleMoveToRegistered = async (reg) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    await updateRegistration(reg.id, { status: 'registered' }, tournamentId)
  }

  // ── Transfer (acceptance flow) ──────────────────────────────────────────────────
  // The picker calls createTransfer, which writes a pending row in
  // registration_transfers. The actual swap of the registration rows
  // happens server-side once the recipient accepts (respond_to_transfer)
  // or the admin force-accepts.
  const startTransfer = (reg) => {
    if (!claimedId && !isAdmin) {
      onNavigate?.('settings')
      return
    }
    setPickerForReg({ reg })
  }
  const handleTransferCreated = ({ transferId, toPlayer }) => {
    setPickerForReg(null)
    setShareModal({ transferId, toPlayer })
  }

  // Pending transfers tied to this tournament. Used to render persistent
  // banners on registration cards and the incoming-offer banner at the
  // top of the page. Both surfaces survive page reloads — transfers are
  // loaded from the DB on app boot, so this state is reproducible.
  const handleCancelMyOffer = async () => {
    if (!pendingFromMe) return
    if (!confirm('Cancel the transfer offer? Your spot stays registered to you.')) return
    setRespondingTo(pendingFromMe.id)
    await cancelTransfer(pendingFromMe.id)
    setRespondingTo(null)
  }
  const handleIncomingResponse = async (xfer, accept) => {
    setRespondingTo(xfer.id)
    const r = await respondToTransfer(xfer.id, accept)
    setRespondingTo(null)
    if (!r.ok) {
      const map = {
        wrong_pin: 'Sign in again to respond.',
        forbidden: 'This transfer is for a different player.',
        not_pending: 'This transfer was already responded to or closed.',
        tournament_started: 'Too late — the event has already started.',
      }
      alert(map[r.status] || 'Could not record your response.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Event meta + actions */}
      <div>
        <div className="flex items-center gap-3">
          <DateTile date={tournament.date} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-800 leading-tight">
              {formatEventDate(tournament.date)}
            </p>
            {tournament.time && (
              <p className="text-sm text-gray-500 leading-tight mt-0.5">
                {tournament.time}
                {tournament.duration ? ` · ${tournament.duration}min` : ''}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <ShareWhatsAppButton tournament={tournament} variant="icon" />
            <AddToCalendarButton tournament={tournament} variant="icon" />
            <EventAdminMenu
              isAdmin={isAdmin}
              onRaffle={() => onNavigate('raffle', tournament)}
              onEligibility={() => onNavigate('eligibility', tournament)}
              onPayments={() => onNavigate('payments', tournament)}
              onScores={() => onNavigate('scores', tournament)}
              onEdit={openEdit}
            />
          </div>
        </div>

        {/* Event description — read-only for players, inline-editable for
            admins (click the pencil → textarea with Save / Cancel). */}
        <EventDescription
          tournament={tournament}
          isAdmin={isAdmin}
          onSave={async (next) => {
            try {
              await updateTournament(tournament.id, { notes: next })
            } catch (err) {
              alert(err?.message || 'Could not save description.')
            }
          }}
        />
      </div>

      {!isAdmin && claimedId && !isCompleted && (
        <MyRegistrationCard
          myReg={myReg}
          myWaitlistReg={myWaitlistReg}
          waitlistPosition={myWaitlistPosition}
          isEventFull={registered.length >= maxPlayers}
          tournament={tournament}
          isAdminAll={isAdminAll}
          hasTikkie={hasTikkie}
          costPerPlayer={costPerPlayer}
          pendingFromMe={pendingFromMe}
          incomingForMe={incomingForMe}
          respondingTo={respondingTo}
          onRegister={handleSelfRegister}
          onMarkTikkied={markTikkied}
          onSelfDeclare={handleSelfDeclareById}
          onStartTransfer={startTransfer}
          onCancelMyOffer={handleCancelMyOffer}
          onOpenShareModal={setShareModal}
          onIncomingResponse={handleIncomingResponse}
          getPlayer={getPlayer}
          saving={saving}
        />
      )}

      {/* Summary bar */}
      <div className="bg-lob-teal rounded-xl p-4 text-white flex items-center justify-between">
        <div className="text-center">
          <p className="text-2xl font-bold">{registered.length}</p>
          <p className="text-xs opacity-75">Registered</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${waitlisted.length > 0 ? 'text-lob-amber' : ''}`}>
            {waitlisted.length}
          </p>
          <p className="text-xs opacity-75">Waitlist</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold">{maxPlayers}</p>
          <p className="text-xs opacity-75">Max players</p>
        </div>
        <div className="text-center">
          <p
            className={`text-2xl font-bold ${registered.length >= maxPlayers ? 'text-lob-amber' : 'text-green-300'}`}
          >
            {Math.max(0, maxPlayers - registered.length)}
          </p>
          <p className="text-xs opacity-75">Spots left</p>
        </div>
      </div>

      {/* Lobster Games Over — results banner (visible for the 48h window) */}
      {showResultsBanner && (
        <button
          onClick={() => onNavigate('game', tournament)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 text-gray-900 font-bold text-sm shadow-md active:scale-95 transition-all"
        >
          🏆 Lobster Games Over — See Results!
        </button>
      )}

      {/* Game button — hidden once the tournament is completed, since the
          results live on the Scores page as a Lobster Games tab. */}
      {!isCompleted && (
        <button
          onClick={() => onNavigate('game', tournament)}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-violet-400 text-white font-semibold text-sm shadow"
        >
          🎮 Lobster Games
        </button>
      )}

      {isAdmin && (
        <AddPlayerCard
          isCompleted={isCompleted}
          showAdd={showAdd}
          onOpen={() => setShowAdd(true)}
          onClose={() => {
            setShowAdd(false)
            setSearch('')
          }}
          search={search}
          onSearchChange={setSearch}
          availablePlayers={availablePlayers}
          selectedPlayer={selectedPlayer}
          onSelectPlayer={setSelectedPlayer}
          onAdd={handleAdd}
          saving={saving}
          registeredCount={registered.length}
          maxPlayers={maxPlayers}
          displayName={displayName}
        />
      )}

      <RegisteredSection
        isCompleted={isCompleted}
        getPlayer={getPlayer}
        registered={registered}
        maxPlayers={maxPlayers}
        isAdmin={isAdmin}
        displayName={displayName}
        onCancelRegistration={handleCancel}
        pendingByFromPlayerId={pendingByFromPlayerId}
        respondingTo={respondingTo}
        onOpenShareModal={setShareModal}
        onCancelMyOffer={handleCancelMyOffer}
        onStartTransfer={startTransfer}
      />

      <WaitlistSection
        isCompleted={isCompleted}
        waitlisted={waitlisted}
        getPlayer={getPlayer}
        displayName={displayName}
        isAdmin={isAdmin}
        onMoveToRegistered={handleMoveToRegistered}
        onCancel={handleCancel}
      />

      <ScoresAndRankingSection
        tournament={tournament}
        players={players}
        isAdmin={isAdmin}
        claimedId={claimedId}
        matches={matchesData}
        registrations={regsData}
        updateMatch={updateMatch}
        updateTournament={updateTournament}
      />

      <CancelledSection
        isCompleted={isCompleted}
        cancelled={cancelled}
        getPlayer={getPlayer}
        displayName={displayName}
      />

      {/* ── POST-REGISTRATION PAYMENT SHEET ── */}
      <RegistrationPaymentSheetModal
        isOpen={!!paymentSheet}
        tournament={tournament}
        paymentSheet={paymentSheet}
        costPerPlayer={costPerPlayer}
        isAdminAll={isAdminAll}
        tikkieClicked={tikkieClicked}
        declaring={declaring}
        onClose={closePaymentSheet}
        onTikkieClick={(regId, currentStatus) => {
          setTikkieClicked(true)
          markTikkied(regId, currentStatus)
        }}
        onSelfDeclare={handleSelfDeclare}
      />

      {/* ── TRANSFER PICKER + PENDING MODALS ── */}
      {pickerForReg && (
        <TransferSpotModal
          tournament={tournament}
          onClose={() => setPickerForReg(null)}
          onTransferCreated={handleTransferCreated}
        />
      )}
      {shareModal && (
        <TransferPendingModal
          transferId={shareModal.transferId}
          toPlayer={shareModal.toPlayer}
          onClose={() => setShareModal(null)}
          onCancel={() => setShareModal(null)}
        />
      )}
      <EventFormModal
        open={showEditForm}
        editId={tournament.id}
        form={editForm}
        setForm={setEditForm}
        saving={editSaving}
        onSubmit={handleEditSubmit}
        onClose={() => setShowEditForm(false)}
        addCourt={addEditCourt}
        removeCourt={removeEditCourt}
        setCourt={setEditCourt}
      />
    </div>
  )
}
