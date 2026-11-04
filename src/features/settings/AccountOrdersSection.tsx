import { ShoppingBag } from 'lucide-react'
import { useMerchItems, useMerchInterests } from '../merch/useMerch'
import { ordersForPlayer } from '../merch/merchSelectors'
import MyOrders from '../merch/MyOrders'
import type { Player } from '../../lib/normalise'
import { Section } from '../../components/ui/Section'
import { TextButton } from '../../components/ui/TextButton'

// Split so the merch queries only mount once there is a player to read orders for.
function OrdersList({ playerId }: { playerId: string }) {
  // Every item, active or not, so an order for a retired item still resolves its name and image.
  const { data: items = [] } = useMerchItems({ activeOnly: false })
  const { data: interests = [] } = useMerchInterests()
  const myOrders = ordersForPlayer({ interests, playerId })
  if (myOrders.length === 0) return null

  return (
    <Section
      title="My Orders"
      icon={<ShoppingBag />}
      action={<TextButton to="/community/shop">Browse shop</TextButton>}
    >
      <MyOrders myOrders={myOrders} items={items} />
    </Section>
  )
}

/** The player's merch orders; hidden until they have one, as the shop holds the empty state. */
export default function AccountOrdersSection({ myPlayer }: { myPlayer: Player | null }) {
  if (!myPlayer) return null
  return <OrdersList playerId={myPlayer.id} />
}
