import { Ban, Clock, Package, CreditCard } from 'lucide-react'

export const STATUS_CONFIG = {
  ordered: { label: 'Ordered', icon: Clock, bg: 'bg-amber-100', text: 'text-amber-700' },
  paid: { label: 'Paid', icon: CreditCard, bg: 'bg-green-100', text: 'text-green-700' },
  delivered: { label: 'Delivered', icon: Package, bg: 'bg-blue-100', text: 'text-blue-700' },
  cancelled: { label: 'Cancelled', icon: Ban, bg: 'bg-red-100', text: 'text-red-500' },
}
