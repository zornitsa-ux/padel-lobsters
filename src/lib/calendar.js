// ============================================================================
//  Padel Lobsters — Calendar helpers
//
//  Generates an .ics (iCalendar) file for a tournament so the player can add
//  it to their calendar of choice (Apple, Google, Outlook, etc.) directly
//  from the browser. Includes two built-in alarms: 24h and 2h before start.
//
//  Why floating/local time? All Padel Lobsters events happen in the same
//  timezone (the player's), so we parse `tournament.date + tournament.time`
//  as local time and let JS convert to a UTC DTSTART/DTEND. That lines up
//  with the player's device clock and doesn't require shipping a tzdb.
// ============================================================================

// Escape a string for safe inclusion in an ICS TEXT property.
const icsEscape = (s) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')

// Format a Date as an ICS UTC timestamp: 20260415T190000Z
const toIcsUtc = (d) =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// Parse a tournament's (date, time) into a local Date. Defaults to 19:00 if
// no time is set. `tournament.date` is stored as YYYY-MM-DD; `tournament.time`
// is a free-text field (e.g. "19:00", "7:30pm"). We accept HH:mm primarily.
const parseTournamentStart = (t) => {
  if (!t?.date) return null
  const time = (t.time || '19:00').trim()
  // Normalise "7pm", "19:00", "19.00" → "HH:mm"
  let hh = 19, mm = 0
  const ampm = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  const hm   = time.match(/^(\d{1,2})[:.](\d{2})$/)
  const hOnly = time.match(/^(\d{1,2})$/)
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
  const [y, mo, d] = t.date.split('-').map(Number)
  if (!y || !mo || !d) return null
  // Note: month is 0-indexed in Date()
  return new Date(y, mo - 1, d, hh, mm, 0, 0)
}

// Build the full ICS string for a single tournament. Returns null if the
// tournament has no date.
export function buildTournamentIcs(tournament) {
  const start = parseTournamentStart(tournament)
  if (!start) return null
  const durationMin = parseInt(tournament.duration) || 90
  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  const now = new Date()
  const uid = `tournament-${tournament.id || 'x'}@padellobsters.app`

  const descParts = [
    'Padel Lobsters tournament 🦞',
    tournament.format ? `Format: ${tournament.format}` : null,
    tournament.maxPlayers ? `Max players: ${tournament.maxPlayers}` : null,
    tournament.notes || null,
    '',
    'See you on court!',
  ].filter(Boolean).join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Padel Lobsters//Tournament//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${icsEscape('🦞 ' + (tournament.name || 'Padel Lobsters'))}`,
    tournament.location ? `LOCATION:${icsEscape(tournament.location)}` : null,
    `DESCRIPTION:${icsEscape(descParts)}`,
    // 24h before — one-day heads-up
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT24H',
    `DESCRIPTION:${icsEscape('Your Padel Lobsters tournament is tomorrow 🦞')}`,
    'END:VALARM',
    // 2h before — grab-your-gear ping
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT2H',
    `DESCRIPTION:${icsEscape('Padel Lobsters in 2 hours — time to grab your gear!')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  return lines
}

// Build a Google Calendar "add event" URL. Opens instantly in the browser
// or Google Calendar app — no file download, no "Save in…" dialog.
// Format: YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ (UTC pair)
export function buildGoogleCalendarUrl(tournament) {
  const start = parseTournamentStart(tournament)
  if (!start) return null
  const durationMin = parseInt(tournament.duration) || 90
  const end = new Date(start.getTime() + durationMin * 60 * 1000)

  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const dates = `${fmt(start)}/${fmt(end)}`

  const descParts = [
    'Padel Lobsters tournament 🦞',
    tournament.format ? `Format: ${tournament.format}` : null,
    tournament.maxPlayers ? `Max players: ${tournament.maxPlayers}` : null,
    tournament.notes || null,
    '',
    'See you on court!',
  ].filter(Boolean).join('\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: '🦞 ' + (tournament.name || 'Padel Lobsters'),
    dates,
    details: descParts,
  })
  if (tournament.location) params.set('location', tournament.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Trigger a download of the .ics file for a tournament. This is the entry
// point the button calls. Works on iPhone (opens the calendar add sheet),
// Android (opens the calendar), and desktop (downloads the file, which the
// default calendar client opens on double-click).
export function downloadTournamentIcs(tournament) {
  const ics = buildTournamentIcs(tournament)
  if (!ics) return false
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const slug = String(tournament.name || 'tournament')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const a = document.createElement('a')
  a.href = url
  a.download = `padel-lobsters-${slug || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
