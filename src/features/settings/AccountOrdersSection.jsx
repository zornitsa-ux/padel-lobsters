import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { supabase } from '../../supabase'
import useRefreshOnFocus from '../../hooks/useRefreshOnFocus'
import MyOrders from '../merch/MyOrders'

export default function AccountOrdersSection({ myPlayer }) {
  const [items, setItems] = useState([])
  const [interests, setInterests] = useState([])

  const loadData = useCallback(async () => {
    if (!myPlayer?.id) return
    const [itemsRes, interestsRes] = await Promise.all([
      supabase.from('merch_items').select('*').order('display_order').order('id'),
      supabase.from('merch_interests').select('*'),
    ])
    if (itemsRes.data) setItems(itemsRes.data)
    if (interestsRes.data) setInterests(interestsRes.data)
  }, [myPlayer?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRefreshOnFocus(loadData)

  if (!myPlayer) return null

  const myOrders = interests.filter(
    (o) => o.player_id === myPlayer.id || String(o.player_id) === String(myPlayer.id),
  )

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
      <MyOrders myOrders={myOrders} items={items} />
    </section>
  )
}
