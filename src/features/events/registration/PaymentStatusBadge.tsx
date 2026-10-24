interface PaymentStatusBadgeProps {
  paymentStatus?: string | null
}

// Legacy `badge-unpaid` class retained deliberately — migrating this to <Badge>
// is design-system phase 3.
export default function PaymentStatusBadge({ paymentStatus }: PaymentStatusBadgeProps) {
  if (paymentStatus === 'paid') {
    return (
      <span className="text-xs font-semibold bg-lob-success-soft text-lob-success px-2 py-0.5 rounded-full">
        Confirmed ✓
      </span>
    )
  }

  if (paymentStatus === 'transferred') {
    return (
      <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
        Transferred
      </span>
    )
  }

  if (paymentStatus === 'pending_confirmation') {
    return (
      <span className="text-xs font-semibold bg-lob-info-soft text-lob-info px-2 py-0.5 rounded-full">
        Paid
      </span>
    )
  }

  if (paymentStatus === 'tikkied') {
    return (
      <span className="text-xs font-semibold bg-lob-warning-soft text-lob-warning px-2 py-0.5 rounded-full">
        Tikkied
      </span>
    )
  }

  return <span className="badge-unpaid">Unpaid</span>
}
