import React, { useCallback, type ComponentProps, useMemo, useState, type FormEvent } from 'react'
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
import { FORMAT_LOCKED_NOTE } from './eventFormModel'
import { useEventForm } from './useEventForm'
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
  isTransferWindowClosed,
  sheetForName,
} from './registration/utils'
import { useSettings } from '../settings/useSettings'
import { useConfirm } from '../../lib/confirmBus'
import { useConfirmOnBehalf } from '../../lib/confirmOnBehalf'
import { useToast } from '../../lib/toastBus'
import { paymentChangeConfirm } from './paymentChangeConfirm'
import RegistrationPaymentSheetModal from './registration/RegistrationPaymentSheetModal'
import AddPlayerCard from './registration/AddPlayerCard'
import JoinEventCard from './registration/JoinEventCard'
import { useSelfRegister } from './registration/useSelfRegister'
import { findMyEntry, rosterLine } from './registration/team/teamHelpers'
import { useTeamEntries } from './teams/useTeams'
import TeamTransferCard from './registration/team/TeamTransferCard'
import TransferSpotCard from './registration/TransferSpotCard'
import { myRegistrationSummary } from './nextMatch'
import RegisteredSection from './registration/RegisteredSection'
import WaitlistSection from './registration/WaitlistSection'
import CancelledSection from './registration/CancelledSection'
import TeamSignup from './registration/team/TeamSignup'
import TeamLists from './registration/team/TeamLists'
import AdminAddTeamCard from './registration/team/AdminAddTeamCard'
import type { TeamSignupResult } from './registration/team/useTeamSignup'
import type { TeamEntry } from './teams/teamTypes'
import type { TournamentInput } from './tournamentQueries'
import { errorMessage } from '../../lib/errors'
import { REGISTER_FAILURE_MESSAGES, registrationMessage } from './registrationStatusMessages'
import type { EventNavigate } from './eventHelpers'
import type { NormalisedTournament } from '../../lib/normalise'
import { isEventOver } from './eventPhase'
import type { Player } from '../../lib/normalise'
import type { NormalisedRegistration } from './registrationQueries'
import type { NormalisedTransfer } from './transferQueries'
import type {
  DisplayName,
  GetPlayer,
  PaymentSheet,
  TransferShareTarget,
} from './registration/utils'
import { Button } from '../../components/ui/Button'

export default function Registration({
  tournament,
  onNavigate,
}: {
  tournament: NormalisedTournament | null
  onNavigate: EventNavigate
}) {
  const confirm = useConfirm()
  const confirmOnBehalf = useConfirmOnBehalf()
  const { showToast } = useToast()
  const { session, isAdmin } = useApp()
  const { updateRegistration, cancelRegistration, registerPlayer, promoteWaitlistRegistration } =
    useRegistrationActions()
  const { data: transfers = [] } = useTransfers()
  const { respondToTransfer, cancelTransfer, adminCancelTransfer } = useTransferActions({ session })
  const updateMut = useUpdateTournament()
  const updateTournament = useCallback(
    (id: string, data: TournamentInput) => updateMut.mutateAsync({ id, data }),
    [updateMut],
  )
  const { data: players = [] } = usePlayers()
  const { data: regsData = [] } = useRegistrations(tournament?.id)
  const { data: settings } = useSettings()
  const transfersClosed = isTransferWindowClosed(tournament)
  const claimedId = session?.user?.id ?? null

  // First names for players, full names for admins. Team events show full names
  // to everyone: picking a partner among people who share a first name.
  const fullNames = isAdmin || tournament?.entryMode === 'team'
  const displayName = useCallback<DisplayName>(
    (p) => (fullNames ? (p.name || '').trim() : (p.name || '').split(' ')[0]),
    [fullNames],
  )

  const [showAdd, setShowAdd] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [saving, setSaving] = useState(false)
  const [cancelledExpanded, setCancelledExpanded] = useState(false)

  // Post-registration payment sheet — shown to the admin after adding a
  // player, so a Tikkie link is on screen to hand over on the spot. Team
  // signups (a captain's own, or an admin's add) open it via `teamPaymentFor`.
  const [paymentSheet, setPaymentSheet] = useState<PaymentSheet | null>(null)
  const [tikkieClicked, setTikkieClicked] = useState(false)
  const [declaring, setDeclaring] = useState(false)

  const [teamPaymentFor, setTeamPaymentFor] = useState<TeamSignupResult | null>(null)

  const closePaymentSheet = () => {
    setPaymentSheet(null)
    setTeamPaymentFor(null)
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

  const eventForm = useEventForm()
  const { openEdit: openEventForm } = eventForm
  const openEdit = useCallback(() => {
    if (tournament) openEventForm(tournament)
  }, [tournament, openEventForm])

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      if ((await eventForm.save()) === 'format_reverted') {
        showToast({
          variant: 'error',
          message: `${FORMAT_LOCKED_NOTE}. The format was put back, so save again.`,
        })
      }
    } catch (err) {
      showToast({ variant: 'error', message: errorMessage(err, 'Could not save event.') })
    }
  }

  const tournamentId = tournament?.id

  const regs = regsData
  const { registered, waitlisted, cancelled } = useMemo(
    () => splitRegistrationsByStatus(regs),
    [regs],
  )
  const { teams, entries: teamEntries } = useTeamEntries({
    tournamentId,
    registrations: regs,
    enabled: tournament?.entryMode === 'team',
  })
  const myTeamEntry = findMyEntry({ entries: teamEntries, playerId: claimedId })
  const availablePlayers = useMemo(() => getAvailablePlayers({ players, regs }), [players, regs])

  const selfRegister = useSelfRegister({
    tournamentId: tournament?.id,
    playerId: claimedId,
  })
  const isCompleted = tournament != null && isEventOver({ tournament })
  const { hasTikkie, tikkieLink, costPerEntry } = useMemo(
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

  const teamSheet = useMemo<PaymentSheet | null>(() => {
    const captainReg =
      teamPaymentFor?.status === 'registered'
        ? regs.find(
            (r) => r.teamId === teamPaymentFor.teamId && r.playerId === teamPaymentFor.captainId,
          )
        : null
    return captainReg
      ? { regId: captainReg.id, playerId: captainReg.playerId, paymentStatus: 'unpaid' }
      : null
  }, [teamPaymentFor, regs])
  const activeSheet = paymentSheet ?? teamSheet
  const sheetForOther = activeSheet != null && activeSheet.playerId !== claimedId
  const sheetPlayerName =
    activeSheet && sheetForOther
      ? sheetForName({ sheet: activeSheet, regs, getPlayer, displayName })
      : null

  const myReg = claimedId
    ? (registered.find((r) => String(r.playerId) === String(claimedId)) ?? null)
    : null

  if (!tournament) {
    return (
      <EmptyState
        icon={<AlertCircle size={36} />}
        title="No event selected"
        action={<Button onClick={() => onNavigate('tournament')}>Go to Events</Button>}
      />
    )
  }

  // No fallback: max_players is NOT NULL and > 0 in the database
  // (20260806213000), so this is the same number the server enforces.
  const maxPlayers = tournament.maxPlayers
  const isTeamEvent = tournament.entryMode === 'team'
  const handleTeamSignedUp = (result: TeamSignupResult) => {
    if (hasTikkie || costPerEntry > 0) setTeamPaymentFor(result)
  }

  // ── Register (the signed-in player, from the Info tab) ─────────────────────
  // ── Register (admin adding another player) ─────────────────────────────────
  const handleAdd = async () => {
    const player = getPlayer(selectedPlayer)
    if (!player) return
    const ok = await confirmOnBehalf({
      title: 'Add this player?',
      lines: [`Player: ${displayName(player)}`, `Event: ${tournament.name}`],
      confirmLabel: 'Add player',
    })
    if (!ok) return
    setSaving(true)
    try {
      const { regId, status } = await registerPlayer(tournament.id, selectedPlayer)
      // Anything but a sign-up leaves the picker open with the reason on
      // screen — closing it would look exactly like a successful add.
      if (status !== 'registered' && status !== 'waitlist') {
        showToast({
          variant: 'error',
          message: registrationMessage({ map: REGISTER_FAILURE_MESSAGES, status }),
        })
        return
      }
      // Only show payment sheet for directly-registered players (not waitlist),
      // and only if there's a Tikkie link or a cost set. A null regId means the
      // insert failed (registerPlayer swallows the error and still reports the
      // status it *would* have used), so there is no registration to pay for.
      if (regId && status === 'registered' && (hasTikkie || costPerEntry > 0)) {
        // registerPlayer inserts every row with payment_status 'unpaid'; the
        // sheet's Tikkie handler needs the *payment* status, not `status`.
        setPaymentSheet({ regId, playerId: selectedPlayer, paymentStatus: 'unpaid' })
        setTikkieClicked(false)
      }
      setSelectedPlayer('')
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  // ── Self-declare payment (post-add payment sheet) ──────────────────────────
  // For someone else, the admin marks it paid outright: they are the one who
  // would confirm a self-declare anyway.
  const handleSelfDeclare = async () => {
    if (!activeSheet?.regId) return
    if (
      sheetForOther &&
      !(await confirmOnBehalf(
        paymentChangeConfirm({ name: sheetPlayerName ?? '', change: 'Mark as paid (tikkie)' }),
      ))
    )
      return
    setDeclaring(true)
    const saved = await updateRegistration(
      activeSheet.regId,
      {
        paymentStatus: sheetForOther ? 'paid' : 'pending_confirmation',
        paymentMethod: 'tikkie',
      },
      tournamentId,
    )
    setDeclaring(false)
    if (saved) closePaymentSheet()
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
    const { promotedPlayerId } = await cancelRegistration(reg.id, tournament.id)
    if (promotedPlayerId) {
      const promoted = getPlayer(promotedPlayerId)
      showToast({
        variant: 'success',
        message: `${promoted ? displayName(promoted) : 'The next player'} moved off the waitlist.`,
      })
    }
  }

  const handleMoveToRegistered = async (reg: NormalisedRegistration) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    await promoteWaitlistRegistration(reg.id, tournament.id)
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
    // The outgoing registration is unpaid → fold the tournament's Tikkie
    // link into the share message so the recipient can pay directly;
    // transfers are between the two players now, not routed through us.
    const fromPaid = pickerForReg?.reg?.paymentStatus === 'paid'
    setPickerForReg(null)
    setShareModal({ transferId, toPlayer, tikkieLink: fromPaid ? null : tikkieLink })
  }
  // Admin-on-behalf path: the swap is already final, there's no offer to
  // share — just confirm and close.
  const handleTransferCompleted = (toPlayer: Player) => {
    setPickerForReg(null)
    showToast({ variant: 'success', message: `Spot transferred to ${toPlayer.name}.` })
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
  // Admin cancelling a transfer started on behalf of someone else's
  // registration (from the registered-players list). Uses admin_cancel_transfer
  // rather than cancel_transfer — the caller isn't the transfer's from_player,
  // so the self-service RPC would reject it as 'forbidden'.
  const handleAdminCancelTransfer = async (transferId: string) => {
    if (
      !(await confirm({
        message: 'Cancel this transfer offer? The spot stays registered to them.',
        destructive: true,
      }))
    )
      return
    setRespondingTo(transferId)
    const r = await adminCancelTransfer(transferId)
    setRespondingTo(null)
    if (!r.ok) {
      alert('Could not cancel the offer. Please try again.')
    }
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
        transfers_closed:
          'Transfers are closed for this event — reach out to the community admins for help.',
        to_already_registered:
          'You are already registered for this event, so there is nothing to accept.',
        from_not_registered: 'That spot is no longer registered — the transfer can’t be completed.',
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
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-lob-line">
          <p className="text-xs text-lob-muted-light">
            Format:{' '}
            <span className="font-medium text-lob-slate">{formatLabel(tournament.format)}</span>
          </p>
          {/* Share + calendar sit with the date and time they act on. */}
          <div className="flex gap-2">
            <ShareWhatsAppButton tournament={tournament} variant="compact" />
            <AddToCalendarButton tournament={tournament} variant="compact" />
          </div>
        </div>
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

      {/* 3. Sign-up — the player's own way in, next to what they just read.
             /me still owns payment; this links there rather than repeat it. */}
      {isTeamEvent && !isAdmin && claimedId && !isCompleted && (
        <TeamSignup
          tournament={tournament}
          viewerId={claimedId}
          players={players}
          regs={regs}
          teams={teams}
          entry={myTeamEntry}
          getPlayer={getPlayer}
          displayName={displayName}
          onSignedUp={handleTeamSignedUp}
        />
      )}

      {!isTeamEvent && !isAdmin && claimedId && !isCompleted && (
        <JoinEventCard
          summary={myRegistrationSummary({ registrations: regs, playerId: claimedId })}
          isEventFull={registered.length >= maxPlayers}
          hasTikkie={hasTikkie}
          registering={selfRegister.registering}
          error={selfRegister.error}
          onRegister={() => void selfRegister.register()}
          onGoToPayment={() => onNavigate('me', tournament)}
        />
      )}

      {/* Spot-transfer flow — payment lives on /me; this stays here since /me
          deliberately doesn't host transfers. */}
      {!isAdmin && claimedId && !isCompleted && (
        <TransferSection
          isTeamEvent={isTeamEvent}
          teamEntry={myTeamEntry}
          card={{
            myReg,
            pendingFromMe,
            incomingForMe,
            respondingTo,
            transfersClosed,
            whatsappLink: settings?.whatsappLink,
            onStartTransfer: startTransfer,
            onCancelMyOffer: handleCancelMyOffer,
            onOpenShareModal: setShareModal,
            onIncomingResponse: handleIncomingResponse,
            getPlayer,
          }}
        />
      )}

      {/* 3. Roster — the two numbers that matter. */}
      {!isCompleted && (
        <RosterLine
          teamEntries={isTeamEvent ? teamEntries : undefined}
          registered={registered.length}
          waitlisted={waitlisted.length}
          maxPlayers={maxPlayers}
        />
      )}

      {isTeamEvent && isAdmin && (
        <AdminAddTeamCard
          tournament={tournament}
          players={players}
          regs={regs}
          getPlayer={getPlayer}
          displayName={displayName}
          onSignedUp={handleTeamSignedUp}
        />
      )}

      {!isTeamEvent && isAdmin && (
        <AddPlayerCard
          isCompleted={isCompleted}
          showAdd={showAdd}
          onOpen={() => setShowAdd(true)}
          onClose={() => setShowAdd(false)}
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
      {isTeamEvent ? (
        <TeamLists
          tournament={tournament}
          isAdmin={isAdmin}
          players={players}
          regs={regs}
          entries={teamEntries}
          getPlayer={getPlayer}
          displayName={displayName}
        />
      ) : (
        <>
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
            onAdminCancelTransfer={handleAdminCancelTransfer}
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
        </>
      )}

      <CancelledSection
        isCompleted={isCompleted}
        cancelled={cancelled}
        getPlayer={getPlayer}
        displayName={displayName}
        expanded={cancelledExpanded}
        onToggle={() => setCancelledExpanded((v) => !v)}
      />

      {/* ── POST-ADD PAYMENT SHEET (admin) ── */}
      <RegistrationPaymentSheetModal
        isOpen={!!activeSheet}
        tournament={tournament}
        paymentSheet={activeSheet}
        forPlayerName={sheetPlayerName}
        costPerEntry={costPerEntry}
        tikkieClicked={tikkieClicked}
        declaring={declaring}
        onClose={closePaymentSheet}
        onTikkieClick={(regId, currentStatus) => {
          setTikkieClicked(true)
          // An admin opening the link says nothing about whether the player paid.
          if (!sheetForOther) markTikkied(regId, currentStatus)
        }}
        onSelfDeclare={handleSelfDeclare}
      />

      {/* ── TRANSFER PICKER + PENDING MODALS ── */}
      {pickerForReg && (
        <TransferSpotModal
          tournament={tournament}
          fromPlayerId={pickerForReg.reg.playerId}
          onClose={() => setPickerForReg(null)}
          onTransferCreated={handleTransferCreated}
          onTransferCompleted={handleTransferCompleted}
        />
      )}
      {shareModal && (
        <TransferPendingModal
          transferId={shareModal.transferId}
          toPlayer={shareModal.toPlayer}
          tikkieLink={shareModal.tikkieLink}
          onClose={() => setShareModal(null)}
          onCancel={() => setShareModal(null)}
        />
      )}
      <EventFormModal {...eventForm.modalProps} onSubmit={(e) => void handleEditSubmit(e)} />
    </div>
  )
}

function TransferSection({
  isTeamEvent,
  teamEntry,
  card,
}: {
  isTeamEvent: boolean
  teamEntry: TeamEntry | null
  card: ComponentProps<typeof TransferSpotCard>
}) {
  if (!isTeamEvent) return <TransferSpotCard {...card} />
  return <TeamTransferCard entry={teamEntry} card={card} />
}

function RosterLine({
  teamEntries,
  registered,
  waitlisted,
  maxPlayers,
}: {
  /** Set on a team event: the line counts teams. */
  teamEntries?: TeamEntry[]
  registered: number
  waitlisted: number
  maxPlayers: number
}) {
  const { main, waiting } = teamEntries
    ? rosterLine({ entries: teamEntries, maxPlayers })
    : {
        main: `${registered} of ${maxPlayers}`,
        waiting: waitlisted > 0 ? `${waitlisted} waiting` : null,
      }
  return (
    <p className="text-sm font-semibold text-lob-slate px-1">
      {main}
      {waiting && <span className="text-lob-muted font-normal"> · {waiting}</span>}
    </p>
  )
}
