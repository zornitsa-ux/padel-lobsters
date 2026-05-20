export const formatOrderTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return (
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

export const getPlayerName = (o, players) => {
  if (!o || !o.player_id) return null
  // Try joined player name first
  if (o.players?.name) return o.players.name
  // Match from players list — compare as strings to avoid type mismatch
  const pid = String(o.player_id)
  const p = players.find((pl) => String(pl.id) === pid)
  return p ? p.name : null
}
