import { useState, useEffect } from 'react'

// ── Live countdown hook (ticks every second) ────────────────────────────────
// Accepts a tournament object with .date ("YYYY-MM-DD") and optional .time
// ("HH:mm" or "7pm" etc.). Parses as LOCAL time so the countdown matches
// what the player sees on their clock — no UTC offset surprise.
export default function useCountdown(tournament) {
  const [now, setNow] = useState(Date.now())
  const dateStr = tournament?.date
  useEffect(() => {
    if (!dateStr) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [dateStr])

  if (!dateStr) return null

  // Parse date + time as local
  const [y, mo, d] = dateStr.split('-').map(Number)
  if (!y || !mo || !d) return null
  let hh = 19,
    mm = 0 // default 19:00 if no time set
  const timeStr = (tournament.time || '').trim()
  if (timeStr) {
    const ampm = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
    const hm = timeStr.match(/^(\d{1,2})[:.](\d{2})$/)
    const hOnly = timeStr.match(/^(\d{1,2})$/)
    if (ampm) {
      hh = parseInt(ampm[1], 10) % 12
      if (/pm/i.test(ampm[3])) hh += 12
      mm = parseInt(ampm[2] || '0', 10)
    } else if (hm) {
      hh = parseInt(hm[1], 10)
      mm = parseInt(hm[2], 10)
    } else if (hOnly) {
      hh = parseInt(hOnly[1], 10)
    }
  }
  const target = new Date(y, mo - 1, d, hh, mm, 0, 0).getTime()
  const diff = target - now
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const secs = Math.floor((diff % 60000) / 1000)
  return { days, hours, mins, secs }
}
