import type { ComponentProps } from 'react'
import type { TeamEntry } from '../../teams/teamTypes'
import TransferSpotCard from '../TransferSpotCard'

// Only a confirmed team can transfer spots (D-015); incoming offers still show.
export default function TeamTransferCard({
  entry,
  card,
}: {
  entry: TeamEntry | null
  card: ComponentProps<typeof TransferSpotCard>
}) {
  const confirmed = entry?.confirmed === true && entry.status === 'registered'
  return <TransferSpotCard {...card} myReg={confirmed ? card.myReg : null} />
}
