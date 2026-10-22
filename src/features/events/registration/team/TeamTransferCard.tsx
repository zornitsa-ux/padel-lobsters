import type { ComponentProps } from 'react'
import type { NormalisedRegistration } from '../../registrationQueries'
import TransferSpotCard from '../TransferSpotCard'
import { useMyTeamEntry } from './useMyTeamEntry'

// Only a confirmed team can transfer spots (D-015); incoming offers still show.
export default function TeamTransferCard({
  tournamentId,
  viewerId,
  regs,
  card,
}: {
  tournamentId: string
  viewerId: string
  regs: NormalisedRegistration[]
  card: ComponentProps<typeof TransferSpotCard>
}) {
  const { entry } = useMyTeamEntry({ tournamentId, regs, viewerId, enabled: true })
  const confirmed = entry?.confirmed === true && entry.status === 'registered'
  return <TransferSpotCard {...card} myReg={confirmed ? card.myReg : null} />
}
