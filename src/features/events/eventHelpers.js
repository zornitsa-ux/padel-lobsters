// Parse ISO date-only strings ("YYYY-MM-DD") as LOCAL midnight to avoid UTC-offset misclassification
export const parseLocalDate = (s) => {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const d = new Date(s)
  return isNaN(d) ? null : d
}

export const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export const formatLabel = (f) =>
  ({
    americano: 'Americano',
    mexicano: 'Mexicano',
    roundrobin: 'Round Robin',
    knockout: 'Knockout',
    lobster_matching: 'Lobster Matching',
  })[f] || f

// Price display helpers
export const pricePerPlayer = (t) => {
  if (t.courtBookingMode === 'admin_all' || !t.courtBookingMode) {
    const tp = parseFloat(t.totalPrice) || 0
    const mp = parseInt(t.maxPlayers) || 16
    return tp > 0 ? tp / mp : 0
  }
  return (t.courts || []).reduce((sum, c) => sum + (parseFloat(c.costPerPerson) || 0), 0)
}
