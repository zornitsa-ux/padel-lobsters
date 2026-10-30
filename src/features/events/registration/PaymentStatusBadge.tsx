import { Badge } from '../../../components/ui/Badge'
import { paymentStatusInfo } from '../paymentStatus'

interface PaymentStatusBadgeProps {
  paymentStatus?: string | null
  detail?: string
}

export default function PaymentStatusBadge({ paymentStatus, detail }: PaymentStatusBadgeProps) {
  const { label, tone } = paymentStatusInfo(paymentStatus)
  return <Badge tone={tone} label={detail ? `${label} · ${detail}` : label} />
}
