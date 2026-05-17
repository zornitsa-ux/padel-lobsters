import React from 'react'

export default function PaymentStatusBadge({ paymentStatus }) {
  if (paymentStatus === 'paid') {
    return (
      <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
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
      <span className="text-xs font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
        Paid
      </span>
    )
  }

  if (paymentStatus === 'tikkied') {
    return (
      <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
        Tikkied
      </span>
    )
  }

  return <span className="badge-unpaid">Unpaid</span>
}
