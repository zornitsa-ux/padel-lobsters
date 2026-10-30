import React from 'react'
import { ArrowRightLeft, Clock } from 'lucide-react'
import type { Player } from '../../lib/normalise'
import type { NormalisedTournament } from '../../lib/normalise'
import type { NormalisedTransfer } from '../events/transferQueries'
import { OutgoingTransferActions, TransferResponseActions } from '../events/TransferActions'
import { AlertBox } from '../../components/ui/AlertBox'
import { formatDate } from '../events/eventHelpers'

const eventLine = (t: NormalisedTournament) =>
  t.date ? `${t.name} · ${formatDate(t.date)}` : t.name

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
          <AlertBox
            key={xfer.id}
            variant="warning"
            icon={<ArrowRightLeft />}
            title={`${fromFirst} wants to transfer their spot to you`}
            actions={
              <TransferResponseActions
                busy={busy}
                acceptLabel="Accept"
                onRespond={({ accept }) => onIncomingResponse(xfer, accept)}
              />
            }
          >
            {t && eventLine(t)}
          </AlertBox>
        )
      })}
      {outgoingTransfers.map((xfer) => {
        const toP = players.find((p) => String(p.id) === String(xfer.toPlayerId))
        const t = tournaments.find((t) => String(t.id) === String(xfer.tournamentId))
        const toFirst = (toP?.name || '').split(/\s+/)[0] || 'them'
        const busy = transferBusy === xfer.id
        return (
          <AlertBox
            key={xfer.id}
            variant="warning"
            icon={<Clock />}
            title={`Pending transfer to ${toFirst} — awaiting acceptance.`}
            actions={
              <OutgoingTransferActions
                onResend={toP ? () => onOutgoingShare(xfer, toP) : undefined}
                onCancel={() => onOutgoingCancel(xfer)}
                busy={busy}
              />
            }
          >
            {t && eventLine(t)}
          </AlertBox>
        )
      })}
    </div>
  )
}
