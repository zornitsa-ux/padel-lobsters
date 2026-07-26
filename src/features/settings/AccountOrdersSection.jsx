import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { useMerchItems, useMerchInterests } from '../merch/useMerch'
import { ordersForPlayer } from '../merch/merchSelectors'
import MyOrders from '../merch/MyOrders'

// Split so the merch queries only mount once there is a player to read orders
// for — the previous direct fetch bailed out on a missing id the same way.
function OrdersList({ playerId }) {
  // Every item, active or not, so an order for a retired item still resolves
  // its name and image.
  const { data: items = [] } = useMerchItems({ activeOnly: false })
  const { data: interests = [] } = useMerchInterests()

  return <MyOrders myOrders={ordersForPlayer({ interests, playerId })} items={items} />
}

export default function AccountOrdersSection({ myPlayer }) {
  if (!myPlayer) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-gray-700 flex items-center gap-1.5">
          <ShoppingBag size={15} className="text-lob-teal" /> My Orders
        </h3>
        <Link to="/community/shop" className="text-xs text-lob-teal font-semibold">
          Browse shop →
        </Link>
      </div>
      <OrdersList playerId={myPlayer.id} />
    </section>
  )
}
