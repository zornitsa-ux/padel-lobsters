import type { NormalisedTournament } from './tournamentQueries'

// App-level navigation callback threaded through every event surface: a
// destination name plus (usually) the tournament being navigated into.
export type EventNavigate = (destination: string, tournament?: NormalisedTournament) => void

// Structural subset of a tournament (or an in-flight event form) needed to
// derive the per-player price. NormalisedTournament satisfies it.
export interface PriceableEvent {
  courtBookingMode?: string | null
  totalPrice?: string | number | null
  maxPlayers?: string | number | null
  courts?: ReadonlyArray<{ costPerPerson?: string | number | null }> | null
}

// Parse ISO date-only strings ("YYYY-MM-DD") as LOCAL midnight to avoid UTC-offset misclassification
export const parseLocalDate = (s: string | null | undefined): Date | null => {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export const formatDate = (d: string | number | Date | null | undefined): string => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const FORMAT_LABELS: Record<string, string> = {
  americano: 'Americano',
  mexicano: 'Mexicano',
  roundrobin: 'Round Robin',
  knockout: 'Knockout',
  lobster_matching: 'Lobster Matching',
}

export const formatLabel = (f: string): string => FORMAT_LABELS[f] || f

// Price display helpers
export const pricePerPlayer = (t: PriceableEvent): number => {
  if (t.courtBookingMode === 'admin_all' || !t.courtBookingMode) {
    const tp = parseFloat(String(t.totalPrice ?? '')) || 0
    const mp = parseInt(String(t.maxPlayers ?? '')) || 16
    return tp > 0 ? tp / mp : 0
  }
  return (t.courts || []).reduce(
    (sum, c) => sum + (parseFloat(String(c.costPerPerson ?? '')) || 0),
    0,
  )
}
