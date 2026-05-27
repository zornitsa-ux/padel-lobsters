import React, { useCallback, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { usePlayers } from '../players/usePlayers'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import TransferSpotModal from '../../components/TransferSpotModal'
import TransferPendingModal from '../../components/TransferPendingModal'
import DateTile from '../../components/ui/DateTile'
import AddToCalendarButton from '../../components/ui/AddToCalendarButton'
import ShareWhatsAppButton from '../../components/ui/ShareWhatsAppButton'
import EventDescription from './EventDescription'
import EventAdminMenu from './EventAdminMenu'
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
import RegisteredSection from './registration/RegisteredSection'
import WaitlistSection from './registration/WaitlistSection'
import CancelledSection from './registration/CancelledSection'
import ScoresAndRankingSection from './registration/ScoresAndRankingSection'

export default function Registration({ tournament, onNavigate }) {
  const {
    registerPlayer,
    cancelRegistration,
    updateRegistration,
    getTournamentRegistrations,
    getTournamentMatches,
    updateMatch,
    updateTournament,
    session,
    transfers,
    cancelTransfer,
    respondToTransfer,
  } = useApp()
  const { data: players = [] } = usePlayers()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

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

  const tournamentId = tournament?.id

  const regs = useMemo(() => {
    if (!tournamentId) return []
    return getTournamentRegistrations(tournamentId)
  }, [getTournamentRegistrations, tournamentId])
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

  if (!tournament) {
    return (
      <div className="card py-10 text-center text-gray-400">
        <AlertCircle size={36} className="mx-auto mb-2 opacity-30" />
        <p>No event selected</p>
        <button
          onClick={() => onNavigate('tournament')}
          className="btn-primary mt-4 py-2 px-5 text-sm"
        >
          Go to Events
        </button>
      </div>
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

  // ── Self-declare payment ──────────────────────────────────────────────────
  const handleSelfDeclare = async () => {
    if (!paymentSheet?.regId) return
    setDeclaring(true)
    await updateRegistration(paymentSheet.regId, {
      paymentStatus: 'pending_confirmation',
      paymentMethod: 'tikkie',
    })
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
      await updateRegistration(regId, {
        paymentStatus: 'tikkied',
        paymentMethod: 'tikkie',
      })
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
    await updateRegistration(reg.id, { status: 'registered' })
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
      {/* Back + header */}
      <div>
        <button
          onClick={() => onNavigate('tournament')}
          className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2"
        >
          <ChevronLeft size={16} /> Events
        </button>
        <h2 className="text-lg font-bold text-gray-800">{tournament.name}</h2>
        <div className="mt-2 flex items-center gap-3">
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

      {/* Summary bar */}
      <div className="bg-lobster-teal rounded-xl p-4 text-white flex items-center justify-between">
        <div className="text-center">
          <p className="text-2xl font-bold">{registered.length}</p>
          <p className="text-xs opacity-75">Registered</p>
        </div>
        <div className="text-center">
          <p className={`text-2xl font-bold ${waitlisted.length > 0 ? 'text-lobster-gold' : ''}`}>
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
            className={`text-2xl font-bold ${registered.length >= maxPlayers ? 'text-lobster-gold' : 'text-green-300'}`}
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

      <RegisteredSection
        isCompleted={isCompleted}
        incomingForMe={incomingForMe}
        getPlayer={getPlayer}
        respondingTo={respondingTo}
        onIncomingResponse={handleIncomingResponse}
        registered={registered}
        maxPlayers={maxPlayers}
        claimedId={claimedId}
        isAdmin={isAdmin}
        displayName={displayName}
        onCancelRegistration={handleCancel}
        hasTikkie={hasTikkie}
        isAdminAll={isAdminAll}
        tournamentTikkieLink={tournament.tikkieLink}
        onMarkTikkied={markTikkied}
        pendingByFromPlayerId={pendingByFromPlayerId}
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
        getTournamentMatches={getTournamentMatches}
        getTournamentRegistrations={getTournamentRegistrations}
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
    </div>
  )
}
