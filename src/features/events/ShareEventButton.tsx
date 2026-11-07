import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { ShareSheet } from '../../components/ui/ShareSheet'
import { isOpenToJoin } from './public/publicEventHelpers'
import type { OverTournament } from './eventPhase'
import { buildEventShareMessage, eventShareUrl, type ShareableEvent } from './eventShareMessage'

export type ShareEvent = ShareableEvent & OverTournament

interface ShareEventButtonProps {
  event?: ShareEvent | null
  /** Registered players now, for a spots-left line. Omit when unknown. */
  registeredCount?: number
  /**
   * 'icon' (square, for headers and cards) or 'full' (a full-width "Share with friends", for
   * the moments worth asking: just registered, the You tab).
   */
  variant?: 'icon' | 'full'
}

interface EventShareSheetProps {
  event: ShareEvent
  registeredCount?: number
  open: boolean
  onClose: () => void
  title?: string
  lead?: string
}

/** The share sheet for an event's link, with a ready-written message. */
export function EventShareSheet({
  event,
  registeredCount,
  open,
  onClose,
  title = 'Share event',
  lead,
}: EventShareSheetProps) {
  const url = eventShareUrl({ event, origin: window.location.origin })
  return (
    <ShareSheet
      open={open}
      onClose={onClose}
      title={title}
      lead={lead}
      message={buildEventShareMessage({ event, url, registeredCount })}
      url={url}
    />
  )
}

function ShareTrigger({
  variant,
  onClick,
}: {
  variant: NonNullable<ShareEventButtonProps['variant']>
  onClick: () => void
}) {
  if (variant === 'icon') {
    return (
      <IconButton onClick={onClick} aria-label="Share event" variant="success">
        <Share2 />
      </IconButton>
    )
  }
  return (
    <Button variant="secondary" onClick={onClick} icon={<Share2 />} fullWidth>
      Share with friends
    </Button>
  )
}

/**
 * Opens the share sheet for an event. Renders nothing once sign-ups close (started, finished or
 * past), since the message invites people to sign up.
 */
export default function ShareEventButton({
  event,
  registeredCount,
  variant = 'icon',
}: ShareEventButtonProps) {
  const [open, setOpen] = useState(false)
  if (!event?.id || !isOpenToJoin({ event })) return null

  return (
    <>
      <ShareTrigger variant={variant} onClick={() => setOpen(true)} />
      <EventShareSheet
        event={event}
        registeredCount={registeredCount}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
