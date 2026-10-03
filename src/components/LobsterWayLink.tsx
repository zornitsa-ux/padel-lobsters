import { Info } from 'lucide-react'
import { LinkCard, LinkCardIcon } from './ui/LinkCard'

// Subtle "The Lobster way" entry point, used at the bottom of both Home and
// Account so it reads as a quiet reference link rather than a promoted feature.
export default function LobsterWayLink() {
  return (
    <LinkCard
      to="/lobster-way"
      leading={
        <LinkCardIcon className="bg-amber-100 text-amber-700">
          <Info size={16} />
        </LinkCardIcon>
      }
      title="The Lobster way"
      subtitle="Rules, perks, and how everything works"
    />
  )
}
