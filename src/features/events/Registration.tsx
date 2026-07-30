import React, { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useApp } from '../../context/useApp'
import { useUpdateTournament } from './useTournaments'
import { useTransfers, useTransferActions } from './useTransfers'
import { usePlayers } from '../players/usePlayers'
import { useRegistrations, useRegistrationActions } from './useRegistrations'
import { AlertCircle, Building2 } from 'lucide-react'
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
import { formatLabel } from './eventHelpers'
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
import { useConfirm } from '../../lib/confirmBus'
import RegistrationPaymentSheetModal from './registration/RegistrationPaymentSheetModal'
import AddPlayerCard from './registration/AddPlayerCard'
import TransferSpotCard from './registration/TransferSpotCard'
import RegisteredSection from './registration/RegisteredSection'
import WaitlistSection from './registration/WaitlistSection'
import CancelledSection from './registration/CancelledSection'
import { errorMessage } from '../../lib/errors'
import type { EventFormValues } from './eventConstants'
import type { EventNavigate } from './eventHelpers'
import type { NormalisedTournament } from '../../lib/normalise'
import type { Player } from '../../lib/normalise'
import type { NormalisedRegistration } from './registrationQueries'
import type { NormalisedTransfer } from './transferQueries'
import type { SetEventFormCourt } from './EventFormModal'
import type {
  DisplayName,
  GetPlayer,
  PaymentSheet,
  TransferShareTarget,
} from './registration/utils'

export default function Registration({
  tournament,
  onNavigate,
}: {
  tournament: NormalisedTournament | null
  onNavigate: EventNavigate
}) {
  const confirm = useConfirm()
  const { session } = useApp()
  const { updateRegistration, cancelRegistration } = useRegistrationActions()
  const { registerPlayer } = useRegistrationActions()
  const { data: transfers = [] } = useTransfers()
  const { respondToTransfer, cancelTransfer } = useTransferActions({ session })
  const updateMut = useUpdateTournament()
  const updateTournament = useCallback(
    (id: string, data: Partial<NormalisedTournament>) => updateMut.mutateAsync({ id, data }),
    [updateMut],
  )
  const { data: players = [] } = usePlayers()
  const { data: regsData = [] } = useRegistrations(tournament?.id)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  // Show first name for players, full name for admins
  const displayName = useCallback<DisplayName>(
    (p) => (isAdmin ? p.name : (p.name || '').split(' ')[0]),
    [isAdmin],
  )

  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelledExpanded, setCancelledExpanded] = useState(false)

  // Post-registration payment sheet — shown to the admin after adding a
  // player, so a Tikkie link is on screen to hand over on the spot.
  const [paymentSheet, setPaymentSheet] = useState<PaymentSheet | null>(null)
  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring] = useState(false)

  const closePaymentSheet = () => {
    setPaymentSheet(null)
    setTikkieClicked(false)
  }

  // Transfer flow modal state.
  //   pickerForReg : { reg } when the recipient picker is open
  //   shareModal   : { transferId, toPlayer } when the share-actions /
  //                  pending modal is open (after creating an offer or
  //                  via 'Resend WhatsApp' on a persistent pending banner)
  const [pickerForReg, setPickerForReg] = useState<{ reg: NormalisedRegistration } | null>(null)
  const [shareModal, setShareModal] = useState<TransferShareTarget | null>(null)
  const [respondingTo, setRespondingTo] = useState<string | null>(null) // transferId being acted on

  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState<EventFormValues>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)

  const openEdit = useCallback(() => {
    const t = tournament
    if (!t) return
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

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!tournament) return
    setEditSaving(true)
    try {
      const mp = parseInt(String(editForm.maxPlayers)) || 16
      const data = {
        name: editForm.name,
        date: editForm.date,
        time: editForm.time,
        location: editForm.location,
        maxPlayers: mp,
        format: editForm.format,
        genderMode: editForm.genderMode,
        courtBookingMode: editForm.courtBookingMode,
        duration: Number(editForm.duration) || 90,
        totalPrice:
          editForm.courtBookingMode === 'admin_all'
            ? (parseFloat(String(editForm.pricePerPerson)) || 0) * mp
            : 0,
        tikkieLink: editForm.courtBookingMode === 'admin_all' ? editForm.tikkieLink || '' : '',
        courts: editForm.courts.map((c) => ({
          name: c.name,
          booked: !!c.booked,
          costPerPerson:
            editForm.courtBookingMode === 'player_responsible'
              ? parseFloat(String(c.costPerPerson)) || 0
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

  const removeEditCourt = (i: number) =>
    setEditForm((f) => ({ ...f, courts: f.courts.filter((_, idx) => idx !== i) }))

  const setEditCourt: SetEventFormCourt = (i, field, value) =>
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
    const map = new Map<string, Player>()
    for (const player of players) map.set(player.id, player)
    return map
  }, [players])
  const getPlayer = useCallback<GetPlayer>(
    (id) => (id == null ? undefined : playerById.get(id)),
    [playerById],
  )

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

  // ── Register (admin adding another player) ─────────────────────────────────
  const handleAdd = async () => {
    if (!selectedPlayer) return
    setSaving(true)
    try {
      const { regId, status } = await registerPlayer(tournament.id, selectedPlayer, maxPlayers)
      // Only show payment sheet for directly-registered players (not waitlist),
      // and only if there's a Tikkie link or a cost set. A null regId means the
      // insert failed (registerPlayer swallows the error and still reports the
      // status it *would* have used), so there is no registration to pay for.
      if (regId && status === 'registered' && (hasTikkie || costPerPlayer > 0)) {
        // registerPlayer inserts every row with payment_status 'unpaid'; the
        // sheet's Tikkie handler needs the *payment* status, not `status`.
        setPaymentSheet({ regId, playerId: selectedPlayer, paymentStatus: 'unpaid' })
        setTikkieClicked(false)
      }
      setSelectedPlayer('')
      setShowAdd(false)
      setSearch('')
    } finally {
      setSaving(false)
    }
  }

  // ── Self-declare payment (post-add payment sheet) ──────────────────────────
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
  const markTikkied = async (regId: string, currentStatus: string | undefined) => {
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
  const handleCancel = async (reg: NormalisedRegistration) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (
      !(await confirm({
        message: `Cancel ${getPlayer(reg.playerId)?.name}'s registration?`,
        destructive: true,
      }))
    )
      return
    await cancelRegistration(reg.id, tournament.id)
  }

  const handleMoveToRegistered = async (reg: NormalisedRegistration) => {
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
  const startTransfer = (reg: NormalisedRegistration) => {
    if (!claimedId && !isAdmin) {
      onNavigate?.('settings')
      return
    }
    setPickerForReg({ reg })
  }
  const handleTransferCreated = ({ transferId, toPlayer }: TransferShareTarget) => {
    setPickerForReg(null)
    setShareModal({ transferId, toPlayer })
  }

  // Pending transfers tied to this tournament. Used to render persistent
  // banners on registration cards and the incoming-offer banner at the
  // top of the page. Both surfaces survive page reloads — transfers are
  // loaded from the DB on app boot, so this state is reproducible.
  const handleCancelMyOffer = async () => {
    if (!pendingFromMe) return
    if (
      !(await confirm({
        message: 'Cancel the transfer offer? Your spot stays registered to you.',
        destructive: true,
      }))
    )
      return
    setRespondingTo(pendingFromMe.id)
    await cancelTransfer(pendingFromMe.id)
    setRespondingTo(null)
  }
  const handleIncomingResponse = async (xfer: NormalisedTransfer, accept: boolean) => {
    setRespondingTo(xfer.id)
    const r = await respondToTransfer(xfer.id, accept)
    setRespondingTo(null)
    if (!r.ok) {
      const map: Record<string, string> = {
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
      {/* 1. Event meta — date, time, location, format. One card. */}
      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <DateTile date={tournament.date} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-lob-dark leading-tight">
              {formatEventDate(tournament.date)}
            </p>
            {tournament.time && (
              <p className="text-sm text-lob-muted leading-tight mt-0.5">
                {tournament.time}
                {tournament.duration ? ` · ${tournament.duration}min` : ''}
              </p>
            )}
            {tournament.location && (
              <p className="text-xs text-lob-teal flex items-center gap-1 mt-0.5">
                <Building2 size={11} /> {tournament.location}
              </p>
            )}
          </div>
          <EventAdminMenu isAdmin={isAdmin} onEdit={openEdit} />
        </div>
        <p className="text-xs text-lob-muted-light pt-2 border-t border-gray-100">
          Format:{' '}
          <span className="font-medium text-lob-slate">{formatLabel(tournament.format)}</span>
        </p>
      </div>

      {/* 2. Description — read-only for players, inline-editable for admins
          (click the pencil → textarea with Save / Cancel). */}
      <EventDescription
        tournament={tournament}
        isAdmin={isAdmin}
        onSave={async (next) => {
          try {
            await updateTournament(tournament.id, { notes: next })
          } catch (err) {
            alert(errorMessage(err, 'Could not save description.'))
          }
        }}
      />

      {/* Spot-transfer flow — registration and payment now live on /me;
          this stays here since /me deliberately doesn't host transfers. */}
      {!isAdmin && claimedId && !isCompleted && (
        <TransferSpotCard
          myReg={myReg}
          pendingFromMe={pendingFromMe}
          incomingForMe={incomingForMe}
          respondingTo={respondingTo}
          onStartTransfer={startTransfer}
          onCancelMyOffer={handleCancelMyOffer}
          onOpenShareModal={setShareModal}
          onIncomingResponse={handleIncomingResponse}
          getPlayer={getPlayer}
        />
      )}

      {/* 3. Roster — the two numbers that matter. */}
      {!isCompleted && (
        <p className="text-sm font-semibold text-lob-slate px-1">
          {registered.length} of {maxPlayers}
          {waitlisted.length > 0 && (
            <span className="text-lob-muted font-normal"> · {waitlisted.length} waiting</span>
          )}
        </p>
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

      {/* 4. Registered · Waitlist · Cancelled (collapsed). */}
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

      <CancelledSection
        isCompleted={isCompleted}
        cancelled={cancelled}
        getPlayer={getPlayer}
        displayName={displayName}
        expanded={cancelledExpanded}
        onToggle={() => setCancelledExpanded((v) => !v)}
      />

      {/* 5. Footer — share + calendar. */}
      <div className="flex gap-2">
        <ShareWhatsAppButton tournament={tournament} variant="full" />
        <AddToCalendarButton tournament={tournament} variant="full" />
      </div>

      {/* ── POST-ADD PAYMENT SHEET (admin) ── */}
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
