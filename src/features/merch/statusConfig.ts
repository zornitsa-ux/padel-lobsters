import { Ban, Clock, Package, CreditCard, type LucideIcon } from 'lucide-react'
import type { OrderStatus } from './merchSchemas'

type StatusConfig = { label: string; icon: LucideIcon; bg: string; text: string }

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  ordered: { label: 'Ordered', icon: Clock, bg: 'bg-amber-100', text: 'text-amber-700' },
  paid: { label: 'Paid', icon: CreditCard, bg: 'bg-green-100', text: 'text-green-700' },
  delivered: { label: 'Delivered', icon: Package, bg: 'bg-blue-100', text: 'text-blue-700' },
  cancelled: { label: 'Cancelled', icon: Ban, bg: 'bg-red-100', text: 'text-red-500' },
}
