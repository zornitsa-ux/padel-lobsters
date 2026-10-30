import { Clock } from 'lucide-react'
import { AlertBox } from '../../../components/ui/AlertBox'

/** The viewer's own waitlisted registration, with their place in the queue when known. */
export default function WaitlistNotice({ position }: { position?: number | null }) {
  return (
    <AlertBox
      variant="warning"
      icon={<Clock />}
      title={`You're on the waitlist${position ? ` · #${position}` : ''}`}
    >
      You&apos;ll be notified if a spot opens up.
    </AlertBox>
  )
}
