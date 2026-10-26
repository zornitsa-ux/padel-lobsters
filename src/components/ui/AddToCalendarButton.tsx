import React from 'react'
import { CalendarPlus } from 'lucide-react'
import { buildGoogleCalendarUrl, type CalendarEvent } from '../../lib/calendar'
import { IconButton } from './IconButton'
import { Button } from './Button'

// ============================================================================
//  AddToCalendarButton
//
//  Opens a Google Calendar pre-fill URL for the tournament. Three variants:
//    - 'full'    → a full-width secondary button (the post-registration popup)
//    - 'compact' → a small labelled button, for a utility action under content
//    - 'icon'    → a square icon button, anywhere space is tight
//
//  The Google Calendar URL is used instead of an .ics download so iOS Safari
//  doesn't treat it as a popup and block it. Two reminders (24h + 2h) are
//  baked into the calendar event so notifications fire locally without
//  needing server-side push.
// ============================================================================

interface AddToCalendarButtonProps {
  tournament: CalendarEvent
  variant?: 'full' | 'compact' | 'icon'
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
        external
        onClick={(e) => e.stopPropagation()}
        aria-label="Add to Google Calendar"
        variant="accent"
        className={className}
      >
        <CalendarPlus />
      </IconButton>
    )
  }

  if (variant === 'compact') {
    return (
      <Button
        variant="neutral"
        size="sm"
        href={gcalUrl}
        external
        onClick={(e) => e.stopPropagation()}
        title="Add to Google Calendar"
        icon={<CalendarPlus />}
        className={className}
      >
        {label || 'Add to calendar'}
      </Button>
    )
  }

  return (
    <Button
      variant="secondary"
      href={gcalUrl}
      external
      onClick={(e) => e.stopPropagation()}
      icon={<CalendarPlus />}
      className={`w-full ${className}`.trim()}
    >
      {label || 'Add to Google Calendar'}
    </Button>
  )
}
