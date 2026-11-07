import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { ShareSheet } from '../../components/ui/ShareSheet'
import { buildEventShareMessage, eventShareUrl, type ShareableEvent } from './eventShareMessage'

interface ShareEventButtonProps {
  event?: ShareableEvent | null
  /** Registered players now, for a spots-left line. Omit when unknown. */
  registeredCount?: number
  /** 'icon' (square) or 'compact' (a small labelled button under content). */
  variant?: 'icon' | 'compact'
}

/** Opens the share sheet for an event's link, with a ready-written message. */
export default function ShareEventButton({
  event,
  registeredCount,
  variant = 'icon',
}: ShareEventButtonProps) {
  const [open, setOpen] = useState(false)
  if (!event?.id) return null

  const openSheet = () => setOpen(true)
  const url = eventShareUrl({ event, origin: window.location.origin })

  return (
    <>
      {variant === 'icon' ? (
        <IconButton onClick={openSheet} aria-label="Share event" variant="success">
          <Share2 />
        </IconButton>
      ) : (
        <Button variant="neutral" size="sm" onClick={openSheet} icon={<Share2 />}>
          Share
        </Button>
      )}
      <ShareSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Share event"
        message={buildEventShareMessage({ event, url, registeredCount })}
        url={url}
      />
    </>
  )
}
