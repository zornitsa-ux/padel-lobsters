import { Ban, Clock, Package, CreditCard, type LucideIcon } from 'lucide-react'
import type { BadgeTone } from '../../components/ui/Badge'
import type { OrderStatus } from './merchSchemas'

type StatusConfig = { label: string; icon: LucideIcon; tone: BadgeTone }

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  ordered: { label: 'Ordered', icon: Clock, tone: 'warning' },
  paid: { label: 'Paid', icon: CreditCard, tone: 'success' },
  delivered: { label: 'Delivered', icon: Package, tone: 'success' },
  cancelled: { label: 'Cancelled', icon: Ban, tone: 'danger' },
}
