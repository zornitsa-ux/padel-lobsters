import React, { useState, useMemo } from 'react'
import { ArrowRightLeft, Search } from 'lucide-react'
import { useApp } from '../context/useApp'
import { usePlayers } from '../features/players/usePlayers'
import { useRegistrations } from '../features/events/useRegistrations'
import { useTransferActions } from '../features/events/useTransfers'
import { Modal } from './ui/Modal'
import { PlayerRow } from './ui/PlayerRow'
import type { Player } from '../lib/normalise'

// Picker modal Josephine sees when she taps "Transfer spot to another player".
// Lists waitlist players first (so transferring to them is a one-tap promotion
// off the waitlist), then everyone else searchable. On confirm, calls
// createTransfer() which writes the pending row in registration_transfers.
//
// Admins can also open this for someone else's registration (RegisteredSection's
// per-row button) — pass `fromPlayerId` for that registration's owner. When it
// differs from the admin's own id, picks go through adminTransferRegistration
// instead: an immediate, cutoff-bypassing swap with no pending-offer step, since
// the point of the admin path is that the outgoing player may be unreachable.
//
// Props:
//   tournament:         the tournament object
//   fromPlayerId:       whose spot this transfers. Defaults to the caller's own
//                        id — no behavior change for the self-service call site.
//   onClose():          dismiss the modal without doing anything
//   onTransferCreated:  ({ transferId, toPlayer }) => void
//                        called after createTransfer returns 'ok' so the caller
//                        can open the share modal next (self-service path only).
//   onTransferCompleted: (toPlayer) => void
//                        called after an admin-on-behalf transfer completes —
//                        there's no offer to share, the swap is already final.
interface TransferSpotModalProps {
  tournament: { id: string }
  fromPlayerId?: string | null
  onClose: () => void
  onTransferCreated?: (result: { transferId: string; toPlayer: Player }) => void
  onTransferCompleted?: (toPlayer: Player) => void
}

// RPC status code → player-facing message. Shared across create_transfer
// (self-service) and admin_transfer_registration (admin-on-behalf) — their
// status vocabularies overlap (invalid_target, not_registered) with a couple
// of admin-only additions (tournament_completed).
const CREATE_ERRORS: Record<string, string> = {
  wrong_pin: 'Sign in again to send a transfer.',
  invalid_target: "That player can't receive a transfer.",
  not_registered: 'You are no longer registered for this event.',
  target_already_registered: 'That player is already registered.',
  tournament_started: 'Too late — the event has already started.',
  transfers_closed: 'Transfers are closed for this event.',
  tournament_completed: "This event is already completed — the spot can't be moved.",
  already_pending: 'You already have a pending transfer for this event.',
  error: 'Something went wrong. Try again.',
}

export default function TransferSpotModal({
  tournament,
  fromPlayerId,
  onClose,
  onTransferCreated,
  onTransferCompleted,
}: TransferSpotModalProps) {
  const { session } = useApp()
  const { createTransfer, adminTransferRegistration } = useTransferActions({ session })
  const { data: players = [] } = usePlayers()
  const { data: regs = [] } = useRegistrations(tournament?.id)
  const claimedId = session?.user?.id ?? null
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const effectiveFromId = fromPlayerId ?? claimedId
  const isAdminOnBehalf =
    isAdmin && !!effectiveFromId && String(effectiveFromId) !== String(claimedId)

  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName = (p: Player) => (isAdmin ? p.name : (p.name || '').split(' ')[0])
  const registeredIds = regs.filter((r) => r.status === 'registered').map((r) => String(r.playerId))
  const waitlistedIds = regs.filter((r) => r.status === 'waitlist').map((r) => String(r.playerId))

  // Build the candidate list. Waitlisted players surface first (one-tap
  // promotion off the waitlist), then everyone else alphabetically. We
  // exclude players who currently hold a registered spot — they can't
  // receive a transfer, and we exclude the spot's own owner (self or, for
  // an admin-on-behalf transfer, the row being transferred).
  const candidates = useMemo(() => {
    const list = players
      .filter((p) => (p.status || 'active') === 'active')
      .filter((p) => String(p.id) !== String(effectiveFromId))
      .filter((p) => !registeredIds.includes(String(p.id)))
      .filter((p) => !search || (p.name || '').toLowerCase().includes(search.toLowerCase()))
    list.sort((a, b) => {
      const aw = waitlistedIds.includes(String(a.id)) ? 0 : 1
      const bw = waitlistedIds.includes(String(b.id)) ? 0 : 1
      if (aw !== bw) return aw - bw
      return (a.name || '').localeCompare(b.name || '')
    })
    return list
  }, [players, effectiveFromId, registeredIds.join(','), waitlistedIds.join(','), search])

  const handlePick = async (toPlayer: Player) => {
    if (busy || !effectiveFromId) return
    setBusy(true)
    setError(null)
    if (isAdminOnBehalf) {
      const result = await adminTransferRegistration(effectiveFromId, toPlayer.id, tournament.id)
      setBusy(false)
      if (result.ok) {
        onTransferCompleted?.(toPlayer)
        return
      }
      setError(CREATE_ERRORS[result.status] || 'Could not transfer the spot.')
      return
    }
    const result = await createTransfer(toPlayer.id, tournament.id)
    setBusy(false)
    if (result.ok) {
      // create_transfer always returns the id alongside an ok status, so the
      // guard is a type narrowing rather than a reachable branch.
      if (result.transferId) onTransferCreated?.({ transferId: result.transferId, toPlayer })
      return
    }
    setError(CREATE_ERRORS[result.status] || 'Could not send the transfer offer.')
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose()
      }}
      title={isAdminOnBehalf ? 'Transfer this spot' : 'Transfer your spot'}
    >
      <div className="space-y-4">
        <p className="text-xs text-lob-muted-light -mt-2">
          {isAdminOnBehalf
            ? 'Pick who takes over. This moves the spot immediately — no acceptance needed.'
            : "Pick who takes over. They'll be asked to accept — your spot stays held until they do."}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-lob-muted-light"
          />
          <input
            type="text"
            placeholder="Search player…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          {candidates.length === 0 && (
            <p className="text-sm text-lob-muted-light text-center py-4">
              No matching players found
            </p>
          )}
          {candidates.map((p) => {
            const isWait = waitlistedIds.includes(String(p.id))
            return (
              <PlayerRow
                key={p.id}
                player={p}
                onClick={() => handlePick(p)}
                disabled={busy}
                className="w-full p-3 rounded-2xl bg-gray-50 hover:bg-lob-cream active:scale-[0.98] transition-all disabled:opacity-40"
                name={
                  <>
                    {displayName(p)}
                    {isWait && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                        On waitlist
                      </span>
                    )}
                  </>
                }
                nameClassName="font-semibold text-sm text-lob-dark flex items-center gap-1.5"
                subtitle={`Lv ${(p.playtomicLevel || 0).toFixed(1)}`}
                trailing={<ArrowRightLeft size={14} className="text-lob-teal flex-shrink-0" />}
              />
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
