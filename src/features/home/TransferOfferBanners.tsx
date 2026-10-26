import React from 'react'
import { ArrowRightLeft, Clock } from 'lucide-react'
import type { Player } from '../../lib/normalise'
import type { NormalisedTournament } from '../../lib/normalise'
import type { NormalisedTransfer } from '../events/transferQueries'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'

interface TransferOfferBannersProps {
  incomingTransfers: NormalisedTransfer[]
  outgoingTransfers: NormalisedTransfer[]
  players: Player[]
  tournaments: NormalisedTournament[]
  transferBusy: string | null
  onIncomingResponse: (xfer: NormalisedTransfer, accept: boolean) => void
  onOutgoingCancel: (xfer: NormalisedTransfer) => void
  onOutgoingShare: (xfer: NormalisedTransfer, toPlayer: Player | undefined) => void
}

// ── Pending transfers ──────────────────────────────────
//     Both incoming offers (someone wants to transfer to me) and
//     outgoing pending offers (I'm waiting on someone to accept).
//     Sourced from registration_transfers via AppContext — survives
//     page reloads.
export default function TransferOfferBanners({
  incomingTransfers,
  outgoingTransfers,
  players,
  tournaments,
  transferBusy,
  onIncomingResponse,
  onOutgoingCancel,
  onOutgoingShare,
}: TransferOfferBannersProps) {
  if (incomingTransfers.length === 0 && outgoingTransfers.length === 0) return null
  return (
    <div className="space-y-2">
      {incomingTransfers.map((xfer) => {
        const fromP = players.find((p) => String(p.id) === String(xfer.fromPlayerId))
        const t = tournaments.find((t) => String(t.id) === String(xfer.tournamentId))
        const fromFirst = (fromP?.name || '').split(/\s+/)[0] || 'Someone'
        const busy = transferBusy === xfer.id
        return (
          <div
            key={xfer.id}
            className="card border border-lob-warning-border bg-lob-warning-light space-y-2"
          >
            <div className="flex items-start gap-2">
              <ArrowRightLeft size={14} className="text-lob-warning mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-lob-warning-strong">
                  <strong>{fromFirst}</strong> wants to transfer their spot to you
                </p>
                {t && (
                  <p className="text-xs text-lob-warning mt-0.5">
                    {t.name}
                    {t.date &&
                      ` · ${new Date(t.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  </p>
                )}
              </div>
            </div>
            <ActionRow>
              <Button
                variant="secondary"
                onClick={() => onIncomingResponse(xfer, false)}
                disabled={busy}
              >
                {busy ? 'Declining…' : 'Decline'}
              </Button>
              <Button onClick={() => onIncomingResponse(xfer, true)} disabled={busy}>
                {busy ? 'Accepting…' : 'Accept'}
              </Button>
            </ActionRow>
          </div>
        )
      })}
      {outgoingTransfers.map((xfer) => {
        const toP = players.find((p) => String(p.id) === String(xfer.toPlayerId))
        const t = tournaments.find((t) => String(t.id) === String(xfer.tournamentId))
        const toFirst = (toP?.name || '').split(/\s+/)[0] || 'them'
        const busy = transferBusy === xfer.id
        return (
          <div
            key={xfer.id}
            className="card border border-lob-warning-border bg-lob-warning-light/60 space-y-2"
          >
            <div className="flex items-start gap-2">
              <Clock size={14} className="text-lob-warning mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-lob-warning-strong">
                  <strong>Pending transfer</strong> to {toFirst} — awaiting acceptance.
                </p>
                {t && (
                  <p className="text-xs text-lob-warning mt-0.5">
                    {t.name}
                    {t.date &&
                      ` · ${new Date(t.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
                  </p>
                )}
              </div>
            </div>
            <ActionRow>
              <Button
                variant="neutral"
                size="sm"
                onClick={() => onOutgoingShare(xfer, toP)}
                disabled={busy || !toP}
              >
                Resend WhatsApp
              </Button>
              <TextButton tone="destructive" onClick={() => onOutgoingCancel(xfer)} disabled={busy}>
                {busy ? 'Cancelling…' : 'Cancel offer'}
              </TextButton>
            </ActionRow>
          </div>
        )
      })}
    </div>
  )
}
