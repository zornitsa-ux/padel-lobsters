import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import { Menu, MenuItem } from '../../components/ui/Menu'

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
    <Menu
      label="Admin tools"
      align={align}
      trigger={(props) => (
        <IconButton {...props} aria-label="Admin tools">
          <MoreVertical />
        </IconButton>
      )}
    >
      {onEdit && (
        <MenuItem icon={<Pencil />} onSelect={onEdit}>
          Edit event
        </MenuItem>
      )}
      {onDelete && (
        <MenuItem icon={<Trash2 />} tone="danger" onSelect={onDelete}>
          Delete event
        </MenuItem>
      )}
    </Menu>
  )
}
