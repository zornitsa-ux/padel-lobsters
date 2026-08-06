import React from 'react'
import { CalendarPlus } from 'lucide-react'
import { buildGoogleCalendarUrl, type CalendarEvent } from '../../lib/calendar'
import { IconButton } from './IconButton'
import { ActionChip } from './ActionChip'

// ============================================================================
//  AddToCalendarButton
//
//  Opens a Google Calendar pre-fill URL for the tournament. Three variants:
//    - 'full' → a pill-shaped CTA button with label (used in the post-reg popup,
//              where it matches the full-width control above it)
//    - 'chip' → a tertiary ghost chip, for a utility action under content
//    - 'icon' → a small square icon button (used next to the date on the
//              event detail page and anywhere space is tight)
//
//  The Google Calendar URL is used instead of an .ics download so iOS Safari
//  doesn't treat it as a popup and block it. Two reminders (24h + 2h) are
//  baked into the calendar event so notifications fire locally without
//  needing server-side push.
// ============================================================================

interface AddToCalendarButtonProps {
  tournament: CalendarEvent
  variant?: 'full' | 'chip' | 'icon'
  className?: string
  label?: React.ReactNode
}

export default function AddToCalendarButton({
  tournament,
  variant = 'full',
  className = '',
  label,
}: AddToCalendarButtonProps) {
  if (!tournament?.date) return null
  const gcalUrl = buildGoogleCalendarUrl(tournament)
  if (!gcalUrl) return null

  // Use a real <a> tag so iOS Safari treats it as a trusted navigation
  // instead of blocking it as a popup (which window.open would trigger).
  if (variant === 'icon') {
    return (
      <IconButton
        href={gcalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Add to Google Calendar"
        title="Add to Google Calendar"
        variant="accent"
        className={className}
      >
        <CalendarPlus size={16} />
      </IconButton>
    )
  }

  if (variant === 'chip') {
    return (
      <ActionChip
        href={gcalUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Add to Google Calendar"
        icon={<CalendarPlus size={13} />}
        className={className}
      >
        {label || 'Add to calendar'}
      </ActionChip>
    )
  }

  return (
    <a
      href={gcalUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`w-full flex items-center justify-center gap-2 border-2 border-lob-teal text-lob-teal font-semibold py-3 rounded-2xl active:scale-95 transition-all ${className}`}
    >
      <CalendarPlus size={18} />
      {label || 'Add to Google Calendar'}
    </a>
  )
}
