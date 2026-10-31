import { Plus, Pencil, X, ShoppingBag } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import type { MerchItem } from './merchSchemas'
import { Button } from '../../components/ui/Button'
import { DragRow, ListCard } from '../../components/ui/ListCard'
import type { DragRowHandlers } from '../../components/ui/useDragReorder'

type AdminItemManagerProps = {
  items: MerchItem[]
  openAdd: () => void
  openEdit: (item: MerchItem) => void
  handleDeleteItem: (id: number) => void
  orderCount: (id: number) => number
  dragRow: (index: number) => DragRowHandlers
}

// ── Manage tab (admin) — drag-and-drop CRUD list of merch items ─────────────
export default function AdminItemManager({
  items,
  openAdd,
  openEdit,
  handleDeleteItem,
  orderCount,
  dragRow,
}: AdminItemManagerProps) {
  return (
    <div className="space-y-4">
      <Button onClick={openAdd} fullWidth icon={<Plus />}>
        Add Merch Item
      </Button>

      <ListCard label="Shop items">
        {items.map((item, idx) => (
          <DragRow key={item.id} {...dragRow(idx)}>
            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-lob-line">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  className="w-full h-full object-cover"
                  alt=""
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag size={18} className="text-lob-muted-light" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lob-dark truncate">{item.name}</p>
              <p className="text-xs text-lob-muted">
                €{item.price.toFixed(0)} · {orderCount(item.id)}{' '}
                {orderCount(item.id) === 1 ? 'order' : 'orders'}
              </p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <IconButton onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} size="sm">
                <Pencil />
              </IconButton>
              <IconButton
                onClick={() => handleDeleteItem(item.id)}
                aria-label={`Delete ${item.name}`}
                variant="destructive"
                size="sm"
              >
                <X />
              </IconButton>
            </div>
          </DragRow>
        ))}
      </ListCard>
    </div>
  )
}
