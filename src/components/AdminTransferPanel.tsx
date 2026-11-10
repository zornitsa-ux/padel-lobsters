import React, { useState } from 'react'
import { ArrowRightLeft, AlertTriangle, Clock } from 'lucide-react'
import { useApp } from '../context/useApp'
import { usePlayers } from '../features/players/usePlayers'
import { useTransfers, useTransferActions } from '../features/events/useTransfers'
import type { NormalisedTransfer } from '../features/events/transferQueries'
import { isStaleTransferStatus } from '../features/events/transferStatus'
import { useToast } from '../lib/toastBus'
import Avatar from './ui/Avatar'
import { Modal } from './ui/Modal'
import { useConfirmOnBehalf } from '../lib/confirmOnBehalf'
import { Button } from './ui/Button'
import { TextButton } from './ui/TextButton'
import { AlertBox } from './ui/AlertBox'
import { EmptyState } from './ui/EmptyState'
import { ListCard, ListRow } from './ui/ListCard'

// Admin-only modal that lists every pending transfer for a tournament and
// surfaces the two admin actions:
//   - Force accept (admin_force_accept_transfer): finalises the offer
//     without the recipient tapping accept. Used when the recipient can't
//     reach the app in time but has confirmed by other means.
//   - Cancel (admin_cancel_transfer): closes the offer; the spot stays with
//     the from-player.
//
// Props:
//   tournament: tournament object whose pending transfers are listed
//   onClose():  dismiss the panel
// RPC status code → admin-facing message.
const FORCE_ACCEPT_ERRORS: Record<string, string> = {
  wrong_admin_pin: 'Sign in as an admin to do this.',
  not_found: 'Transfer no longer exists.',
  not_pending: 'Transfer was already responded to.',
  tournament_started: 'Too late — the event has already started.',
  transfers_closed: 'Transfers for this event have closed.',
  to_already_registered: 'The recipient is already registered for this event.',
  from_not_registered: 'The sender is no longer registered — the transfer can’t be completed.',
}

const CANCEL_ERRORS: Record<string, string> = {
  wrong_admin_pin: 'Sign in as an admin to do this.',
  not_found: 'Transfer no longer exists.',
  not_pending: 'Transfer was already responded to.',
}

type TransferResult = { ok: boolean; status: string }
type ConfirmOnBehalf = ReturnType<typeof useConfirmOnBehalf>

const formatElapsed = (createdAt?: string | null) => {
  if (!createdAt) return ''
  const ms = Date.now() - new Date(createdAt).getTime()
  if (ms < 0) return 'just now'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

interface PendingTransferRowProps {
  xfer: NormalisedTransfer
  fromName?: string
  toName?: string
  eventName: string
  confirmOnBehalf: ConfirmOnBehalf
  forceAccept: (transferId: string) => Promise<TransferResult>
  cancelOffer: (transferId: string) => Promise<TransferResult>
}

function PendingTransferRow({
  xfer,
  fromName,
  toName,
  eventName,
  confirmOnBehalf,
  forceAccept,
  cancelOffer,
}: PendingTransferRowProps) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Never confirm an on-behalf write without naming both players.
  const namesKnown = !!fromName && !!toName
  const who = [`From: ${fromName}`, `To: ${toName}`, `Event: ${eventName}`]

  const run = async ({
    action,
    errors,
    fallback,
  }: {
    action: (transferId: string) => Promise<TransferResult>
    errors: Record<string, string>
    fallback: string
  }) => {
    setBusy(true)
    setError(null)
    const r = await action(xfer.id)
    setBusy(false)
    if (r.ok) return
    const message = errors[r.status] || fallback
    // The refreshed list drops a stale row, and its inline error with it.
    if (isStaleTransferStatus(r.status)) showToast({ variant: 'error', message })
    else setError(message)
  }

  const handleForceAccept = async () => {
    const ok = await confirmOnBehalf({
      title: 'Force-accept this transfer?',
      lines: [...who, `The spot moves to ${toName}.`],
      confirmLabel: 'Force accept',
    })
    if (!ok) return
    await run({
      action: forceAccept,
      errors: FORCE_ACCEPT_ERRORS,
      fallback: 'Could not force-accept the transfer.',
    })
  }

  const handleCancel = async () => {
    const ok = await confirmOnBehalf({
      title: 'Cancel this transfer offer?',
      lines: [...who, `The spot stays with ${fromName}.`],
      confirmLabel: 'Cancel offer',
      cancelLabel: 'Keep offer',
      destructive: true,
    })
    if (!ok) return
    await run({
      action: cancelOffer,
      errors: CANCEL_ERRORS,
      fallback: 'Could not cancel the transfer.',
    })
  }

  return (
    <ListRow>
      <div className="flex items-center gap-3">
        <Avatar player={{ name: fromName || '?' }} size="sm" />
        <div className="flex-1 min-w-0 text-sm font-semibold text-lob-dark truncate">
          {fromName || '—'}
        </div>
        <ArrowRightLeft size={14} className="text-lob-muted" />
        <Avatar player={{ name: toName || '?' }} size="sm" />
        <div className="flex-1 min-w-0 text-sm font-semibold text-lob-dark truncate">
          {toName || '—'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-lob-warning">
        <Clock size={11} /> Sent {formatElapsed(xfer.createdAt)} · awaiting acceptance
      </div>

      {error && (
        <AlertBox variant="error" size="sm" icon={<AlertTriangle />}>
          {error}
        </AlertBox>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="neutral"
          size="sm"
          onClick={handleForceAccept}
          disabled={busy || !namesKnown}
        >
          {busy ? 'Working…' : 'Force accept'}
        </Button>
        <TextButton tone="destructive" onClick={handleCancel} disabled={busy || !namesKnown}>
          {busy ? '…' : 'Cancel offer'}
        </TextButton>
      </div>
    </ListRow>
  )
}

interface AdminTransferPanelProps {
  tournament?: { id?: string | number | null; name?: string | null } | null
  onClose: () => void
}

export default function AdminTransferPanel({ tournament, onClose }: AdminTransferPanelProps) {
  const confirmOnBehalf = useConfirmOnBehalf()
  const { session, isAdmin } = useApp()
  const { data: transfers = [] } = useTransfers()
  const { forceAcceptTransfer, adminCancelTransfer } = useTransferActions({ session })
  const { data: players = [] } = usePlayers()

  if (!isAdmin) return null

  const pending = transfers.filter(
    (t) => t.status === 'pending' && String(t.tournamentId) === String(tournament?.id),
  )

  const getPlayer = (id?: string | null) => players.find((p) => String(p.id) === String(id))

  return (
    <Modal open onClose={onClose} title="Pending transfers">
      <div className="space-y-4">
        <p className="caption -mt-2">{tournament?.name}</p>

        {pending.length === 0 && (
          <EmptyState variant="inline" title="No pending transfers for this event." />
        )}

        <ListCard inset label="Pending transfers">
          {pending.map((xfer) => (
            <PendingTransferRow
              key={xfer.id}
              xfer={xfer}
              fromName={getPlayer(xfer.fromPlayerId)?.name}
              toName={getPlayer(xfer.toPlayerId)?.name}
              eventName={tournament?.name || 'this event'}
              confirmOnBehalf={confirmOnBehalf}
              forceAccept={forceAcceptTransfer}
              cancelOffer={adminCancelTransfer}
            />
          ))}
        </ListCard>

        <p className="caption text-center pt-1">
          Force accept finalises the transfer immediately. The recipient's spot becomes registered,
          and the from-player's registration is cancelled.
        </p>
      </div>
    </Modal>
  )
}
