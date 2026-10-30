import React, { useMemo, useState } from 'react'
import {
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  AlertCircle,
  ChevronLeft,
  LogOut,
} from 'lucide-react'
import { useApp } from '../context/useApp'
import { usePlayers } from '../features/players/usePlayers'
import { useTournaments } from '../features/events/useTournaments'
import { useTransfers, useTransferActions } from '../features/events/useTransfers'
import Avatar from './ui/Avatar'
import { EmptyState } from './ui/EmptyState'
import { Spinner } from './ui/Spinner'
import { useConfirm } from '../lib/confirmBus'
import type { Player } from '../lib/normalise'
import type { EventNavigate } from '../features/events/eventHelpers'
import { Button } from './ui/Button'
import { TextButton } from './ui/TextButton'
import { TransferResponseActions } from '../features/events/TransferActions'
import { AlertBox } from './ui/AlertBox'
import { loadFailed } from '../lib/queryState'

// Landing page Melanie hits after tapping the WhatsApp link
// (https://padelobsters.nl/?transfer=<id>). Shows the offer details and an
// Accept / Decline action that calls respondToTransfer().
//
// VerificationGate wraps this page (it isn't in PUBLIC_PAGES), so by the
// time the user reaches this component they've already signed in.
// If they're signed in as a different person than the offer's recipient,
// we show that explicitly and offer to sign out so they can sign in again
// as the recipient.
//
// Props:
//   transferId: from the ?transfer=<id> deep link
//   onNavigate(page, tournament?): standard nav helper used across the app
interface TransferAcceptProps {
  transferId?: string | null
  onNavigate?: EventNavigate
}

// RPC status code → recipient-facing message.
const RESPOND_ERRORS: Record<string, string> = {
  wrong_pin: 'Sign in again to respond.',
  forbidden: 'This transfer is for a different player.',
  not_found: 'This transfer no longer exists.',
  not_pending: 'This transfer was already responded to or closed.',
  tournament_started: 'Too late — the event has already started.',
  to_already_registered:
    'You are already registered for this event, so there is nothing to accept.',
  from_not_registered: 'That spot is no longer registered — the transfer can’t be completed.',
  error: 'Something went wrong. Try again.',
}

// How a non-pending transfer is described on the "already resolved" card.
const CLOSED_STATE_LABELS: Record<string, string> = {
  accepted: 'already accepted',
  declined: 'already declined',
  cancelled: 'been cancelled',
  auto_closed: 'closed because the event has started',
}

export default function TransferAccept({ transferId, onNavigate }: TransferAcceptProps) {
  const confirm = useConfirm()
  const { session, logout, sessionSettled, isAdmin } = useApp()
  const { data: tournaments = [] } = useTournaments()
  const transfersQuery = useTransfers()
  const transfersPending = transfersQuery.isPending
  const transfersFailed = loadFailed(transfersQuery)
  const { respondToTransfer } = useTransferActions({ session })
  const { data: players = [] } = usePlayers()
  const claimedId = session?.user?.id ?? null

  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [done, setDone] = useState<{ kind: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const transfer = useMemo(
    () => transfersQuery.data?.find((t) => String(t.id) === String(transferId)),
    [transfersQuery.data, transferId],
  )
  const fromPlayer = transfer && players.find((p) => String(p.id) === String(transfer.fromPlayerId))
  const toPlayer = transfer && players.find((p) => String(p.id) === String(transfer.toPlayerId))
  const tournament =
    transfer && tournaments.find((t) => String(t.id) === String(transfer.tournamentId))

  // First name only for non-admins (matches the rest of the app's privacy
  // posture — players_public hides full names).
  const dn = (p?: Player | null) => (p ? (isAdmin ? p.name : (p.name || '').split(/\s+/)[0]) : '—')

  const isMyOffer = transfer && claimedId && String(claimedId) === String(transfer.toPlayerId)
  const wrongIdentity = transfer && claimedId && !isMyOffer

  const handleRespond = async (accept: boolean) => {
    if (busy || done || !transfer) return
    setBusy(accept ? 'accept' : 'decline')
    setError(null)
    const r = await respondToTransfer(transfer.id, accept)
    setBusy(null)
    if (r.ok) {
      setDone({ kind: r.status }) // 'accepted' or 'declined'
      return
    }
    setError(RESPOND_ERRORS[r.status] || 'Could not record your response.')
  }

  const handleSignOut = async () => {
    if (!(await confirm({ message: `Sign out so you can sign in as ${dn(toPlayer)}?` }))) return
    logout?.()
    // After logout, claimedId becomes null and VerificationGate will
    // re-prompt for sign-in on this same page (the ?transfer= deep link is
    // gone from the URL but our prop persists across the re-render).
  }

  // ── Loading / not-found / error states ───────────────────────────────────
  // Until transfers land, a missing one would read as "couldn't find".
  if (!sessionSettled || transfersPending) return <Spinner label="Loading transfer…" />
  if (transfersFailed) {
    return (
      <AlertBox variant="error">Couldn&apos;t load this transfer. Reload to try again.</AlertBox>
    )
  }

  if (!transferId) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title="No transfer link found."
        action={<Button onClick={() => onNavigate?.('dashboard')}>Back to home</Button>}
      />
    )
  }

  if (!transfer) {
    return (
      <EmptyState
        icon={<AlertCircle />}
        title="We couldn't find this transfer."
        description="It may have been cancelled or already accepted."
        action={<Button onClick={() => onNavigate?.('dashboard')}>Back to home</Button>}
      />
    )
  }

  // ── Already-resolved state ───────────────────────────────────────────────
  if (transfer.status !== 'pending' && !done) {
    const stateLabel = CLOSED_STATE_LABELS[transfer.status ?? ''] || 'already closed'
    return (
      <EmptyState
        icon={<AlertCircle />}
        title={`This transfer has ${stateLabel}.`}
        action={
          tournament && (
            <Button onClick={() => onNavigate?.('registration', tournament)}>See the event</Button>
          )
        }
      />
    )
  }

  // ── Just accepted/declined this turn — confirmation card ─────────────────
  if (done) {
    const isAccept = done.kind === 'accepted'
    return (
      <div className="card py-8 text-center space-y-3">
        {isAccept ? (
          <CheckCircle size={42} className="mx-auto text-lob-success-solid" />
        ) : (
          <XCircle size={42} className="mx-auto text-lob-muted-light" />
        )}
        <h2 className="font-bold text-lg">{isAccept ? `You're in!` : `Offer declined`}</h2>
        <p className="text-sm text-lob-slate">
          {isAccept
            ? `You've taken over ${dn(fromPlayer)}'s spot for ${tournament?.name || 'the event'}. They'll send you the payment link separately.`
            : `We've let ${dn(fromPlayer)} know you can't take the spot.`}
        </p>
        {tournament && (
          <Button onClick={() => onNavigate?.('registration', tournament)}>
            {isAccept ? 'See the event' : 'Back to events'}
          </Button>
        )}
      </div>
    )
  }

  // ── Wrong-identity guard ─────────────────────────────────────────────────
  if (wrongIdentity) {
    return (
      <div className="card py-8 text-center space-y-3">
        <AlertCircle size={36} className="mx-auto text-lob-warning-solid" />
        <h2 className="font-bold text-base">This transfer is for {dn(toPlayer)}</h2>
        <p className="text-sm text-lob-slate">
          You're currently signed in as someone else. Sign out and back in with {dn(toPlayer)}'s
          email to accept or decline.
        </p>
        <Button onClick={handleSignOut} icon={<LogOut />}>
          Sign out
        </Button>
      </div>
    )
  }

  // ── Main offer view ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <TextButton
        tone="neutral"
        icon={<ChevronLeft size={14} />}
        onClick={() => onNavigate?.('dashboard')}
      >
        Home
      </TextButton>

      <div className="card space-y-4">
        <AlertBox variant="warning" icon={<ArrowRightLeft />}>
          <strong>{dn(fromPlayer)}</strong> wants to transfer their spot to you
        </AlertBox>

        <div>
          <h2 className="font-bold text-lg">{tournament?.name || 'Event'}</h2>
          <p className="text-xs text-lob-muted mt-0.5">
            {tournament?.date
              ? new Date(tournament.date).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : '—'}
            {tournament?.time && ` · ${tournament.time}`}
            {tournament?.location && ` · ${tournament.location}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Avatar player={{ name: fromPlayer?.name || '?' }} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{dn(fromPlayer)}</p>
            <p className="text-xs text-lob-muted">From</p>
          </div>
          <ArrowRightLeft size={16} className="text-lob-muted-light/60" />
          <div className="flex-1 min-w-0 text-right">
            <p className="font-semibold text-sm">{dn(toPlayer)}</p>
            <p className="text-xs text-lob-muted">To you</p>
          </div>
          <Avatar player={{ name: toPlayer?.name || '?' }} size="lg" />
        </div>

        <p className="text-xs text-lob-muted leading-relaxed">
          If you accept, the spot moves to you and {dn(fromPlayer)}'s registration is cancelled.
          They'll share the payment link with you separately on WhatsApp.
        </p>

        {error && (
          <AlertBox variant="error" size="sm">
            {error}
          </AlertBox>
        )}

        <TransferResponseActions
          busy={busy ?? false}
          acceptLabel="Accept transfer"
          onRespond={({ accept }) => handleRespond(accept)}
        />
      </div>
    </div>
  )
}
