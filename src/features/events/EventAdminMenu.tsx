import { lazy, Suspense } from 'react'
import { MoreVertical } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'

// Radix DropdownMenu is about 18 KB gzip; event pages load it for admins only.
const EventAdminTools = lazy(() => import('./EventAdminTools'))

// Shared admin-tools overflow menu for a tournament. Renders nothing for
// non-admins. Each action is optional — pass only the handlers the surface
// needs, and the matching item appears.
//
// Raffle, eligibility, payments and scores moved to /manage's tabs/sections
// (EventManage.tsx) — this menu now only carries Edit/Delete.
interface EventAdminMenuProps {
  isAdmin: boolean
  onEdit?: () => void
  onDelete?: () => void
  align?: 'left' | 'right'
}

export default function EventAdminMenu({
  isAdmin,
  onEdit = undefined,
  onDelete = undefined,
  align = 'right',
}: EventAdminMenuProps) {
  if (!isAdmin || (!onEdit && !onDelete)) return null

  return (
    <Suspense
      fallback={
        <IconButton aria-label="Admin tools" disabled>
          <MoreVertical />
        </IconButton>
      }
    >
      <EventAdminTools onEdit={onEdit} onDelete={onDelete} align={align} />
    </Suspense>
  )
}
