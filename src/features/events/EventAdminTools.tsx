import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import { Menu, MenuItem } from '../../components/ui/Menu'

interface EventAdminToolsProps {
  onEdit?: () => void
  onDelete?: () => void
  align: 'left' | 'right'
}

export default function EventAdminTools({ onEdit, onDelete, align }: EventAdminToolsProps) {
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
