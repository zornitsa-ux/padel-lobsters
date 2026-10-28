import { Pencil, Trash2 } from 'lucide-react'
import { Menu, MenuItem } from '../../components/ui/Menu'
import { AdminToolsButton } from './EventAdminMenu'

interface EventAdminToolsProps {
  onEdit?: () => void
  onDelete?: () => void
  align: 'left' | 'right'
}

export default function EventAdminTools({ onEdit, onDelete, align }: EventAdminToolsProps) {
  return (
    <Menu label="Admin tools" align={align} trigger={(props) => <AdminToolsButton {...props} />}>
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
