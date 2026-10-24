import { Ban, Clock, Package, CreditCard, type LucideIcon } from 'lucide-react'
import type { OrderStatus } from './merchSchemas'

type StatusConfig = { label: string; icon: LucideIcon; bg: string; text: string }

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  ordered: { label: 'Ordered', icon: Clock, bg: 'bg-lob-warning-soft', text: 'text-lob-warning' },
  paid: { label: 'Paid', icon: CreditCard, bg: 'bg-lob-success-soft', text: 'text-lob-success' },
  delivered: { label: 'Delivered', icon: Package, bg: 'bg-blue-100', text: 'text-blue-700' },
  cancelled: { label: 'Cancelled', icon: Ban, bg: 'bg-lob-danger-soft', text: 'text-lob-danger' },
}
