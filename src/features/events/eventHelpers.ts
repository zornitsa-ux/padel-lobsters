// The only fields the App-level navigation shim reads off the payload. Callers
// usually pass a whole NormalisedTournament, which satisfies this.
export interface NavigateTarget {
  id?: string | number
  focusPlayerId?: string
}

// App-level navigation callback threaded through every event surface: a
// destination name plus (usually) the tournament being navigated into.
export type EventNavigate = (destination: string, target?: NavigateTarget | null) => void

// Structural subset of a tournament (or an in-flight event form) needed to
// derive the per-player price. NormalisedTournament satisfies it.
export interface PriceableEvent {
  totalPrice?: string | number | null
  maxPlayers?: string | number | null
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

// Single source of truth for per-player price. Every surface that shows a
// price (event cards, payments tab, registration payment sheet) must go
// through this, or the same event shows different amounts in each place.
// A missing/zero maxPlayers falls back to the standard 16-player event.
export const DEFAULT_MAX_PLAYERS = 16

export const pricePerPlayer = (t: PriceableEvent | null | undefined): number => {
  const tp = parseFloat(String(t?.totalPrice ?? '')) || 0
  const mp = parseInt(String(t?.maxPlayers ?? '')) || DEFAULT_MAX_PLAYERS
  return tp > 0 ? tp / mp : 0
}
