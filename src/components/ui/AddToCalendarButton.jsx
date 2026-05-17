import React from 'react'
import { CalendarPlus } from 'lucide-react'
import { buildGoogleCalendarUrl } from '../../lib/calendar'

// ============================================================================
//  AddToCalendarButton
//
//  Opens a Google Calendar pre-fill URL for the tournament. Two variants:
//    - 'full' → a pill-shaped CTA button with label (used in the post-reg popup)
//    - 'icon' → a small square icon button (used next to the date on the
//              event detail page and anywhere space is tight)
//
//  The Google Calendar URL is used instead of an .ics download so iOS Safari
//  doesn't treat it as a popup and block it. Two reminders (24h + 2h) are
//  baked into the calendar event so notifications fire locally without
//  needing server-side push.
// ============================================================================

export default function AddToCalendarButton({
  tournament,
  variant = 'full',
  className = '',
  label,
}) {
  if (!tournament?.date) return null
  const gcalUrl = buildGoogleCalendarUrl(tournament)
  if (!gcalUrl) return null

  // Use a real <a> tag so iOS Safari treats it as a trusted navigation
  // instead of blocking it as a popup (which window.open would trigger).
  if (variant === 'icon') {
    return (
      <a
        href={gcalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Add to Google Calendar"
        title="Add to Google Calendar"
        className={`w-9 h-9 flex items-center justify-center rounded-xl bg-lobster-cream text-lobster-teal active:scale-95 transition-all ${className}`}
      >
        <CalendarPlus size={16} />
      </a>
    )
  }

  return (
    <a
      href={gcalUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`w-full flex items-center justify-center gap-2 border-2 border-lobster-teal text-lobster-teal font-semibold py-3 rounded-2xl active:scale-95 transition-all ${className}`}
    >
      <CalendarPlus size={18} />
      {label || 'Add to Google Calendar'}
    </a>
  )
}
