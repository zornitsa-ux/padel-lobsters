import { ShoppingBag } from 'lucide-react'
import { useMerchItems, useMerchInterests } from '../merch/useMerch'
import { ordersForPlayer } from '../merch/merchSelectors'
import MyOrders from '../merch/MyOrders'
import type { Player } from '../../lib/normalise'
import { Section } from '../../components/ui/Section'
import { TextButton } from '../../components/ui/TextButton'

// Split so the merch queries only mount once there is a player to read orders
// for — the previous direct fetch bailed out on a missing id the same way.
function OrdersList({ playerId }: { playerId: string }) {
  // Every item, active or not, so an order for a retired item still resolves
  // its name and image.
  const { data: items = [] } = useMerchItems({ activeOnly: false })
  const { data: interests = [] } = useMerchInterests()

  return <MyOrders myOrders={ordersForPlayer({ interests, playerId })} items={items} />
}

export default function AccountOrdersSection({ myPlayer }: { myPlayer: Player | null }) {
  if (!myPlayer) return null

  return (
    <Section
      title="My Orders"
      icon={<ShoppingBag />}
      action={<TextButton to="/community/shop">Browse shop</TextButton>}
    >
      <OrdersList playerId={myPlayer.id} />
    </Section>
  )
}
