import React from 'react'
import { Share2 } from 'lucide-react'
import { IconButton } from './IconButton'
import { Button } from './Button'

// ============================================================================
//  ShareWhatsAppButton
//
//  Opens WhatsApp with a pre-filled message containing the event link, date,
//  time and name. The link points to /events/:id which the app routes to the
//  registration page for that tournament. Legacy ?event=<id> links from
//  older messages still resolve via App.jsx's DeepLinkMigrator.
//
//  Two variants: 'icon' (square) and 'compact' (a small labelled button, for
//  a utility action sitting under content).
// ============================================================================

// Structural subset of a tournament this button reads. NormalisedTournament
// satisfies it.
export interface ShareableEvent {
  id?: string | number | null
  name?: string | null
  date?: string | null
  time?: string | null
  location?: string | null
}

interface ShareWhatsAppButtonProps {
  tournament?: ShareableEvent | null
  variant?: 'icon' | 'compact'
}

export default function ShareWhatsAppButton({
  tournament,
  variant = 'icon',
}: ShareWhatsAppButtonProps) {
  if (!tournament?.id) return null

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    const eventUrl = `${window.location.origin}/events/${tournament.id}`

    const d = tournament.date ? new Date(tournament.date) : null
    const dateLine =
      d && !isNaN(d.getTime())
        ? d.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : ''
    const timePart = tournament.time ? ` at ${tournament.time}` : ''
    const locationPart = tournament.location ? `\n${tournament.location}` : ''

    const text = [
      `🦞 ${tournament.name || 'Padel Lobsters Event'}`,
      dateLine ? `📅 ${dateLine}${timePart}` : '',
      locationPart ? `📍${locationPart}` : '',
      '',
      `Register & see details:`,
      eventUrl,
    ]
      .filter(Boolean)
      .join('\n')

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
  }

  if (variant === 'icon') {
    return (
      <IconButton onClick={handleClick} aria-label="Share on WhatsApp" variant="success">
        <Share2 />
      </IconButton>
    )
  }

  return (
    <Button
      variant="neutral"
      size="sm"
      onClick={handleClick}
      title="Share on WhatsApp"
      aria-label="Share on WhatsApp"
      icon={<Share2 />}
    >
      Share
    </Button>
  )
}
