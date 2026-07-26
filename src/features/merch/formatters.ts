import type { Player } from '../../lib/normalise'
import type { MerchInterest } from './merchSchemas'

export const formatOrderTime = (ts: string | null | undefined): string => {
  if (!ts) return ''
  const d = new Date(ts)
  return (
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

// Supabase rejects with PostgrestError, not Error, so `err.message` needs a
// guard before it reaches an alert.
export const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return 'Unknown error'
}

// Sort key for order lists. A missing/unparseable timestamp sorts last rather
// than producing NaN comparisons.
export const orderTimestamp = (ts: string | null | undefined): number => {
  const parsed = ts ? Date.parse(ts) : NaN
  return Number.isNaN(parsed) ? 0 : parsed
}

// Ids are compared as strings: merch_interests.player_id is text while players
// carry a uuid. Returns null for an order whose player is no longer on the
// roster — callers use that to hide the row.
export const getPlayerName = ({
  order,
  players,
}: {
  order: MerchInterest | null | undefined
  players: Player[]
}): string | null => {
  if (!order?.playerId) return null
  const p = players.find((pl) => String(pl.id) === order.playerId)
  return p ? p.name : null
}
