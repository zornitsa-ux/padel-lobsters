import { useState } from 'react'
import { Settings, Gamepad2, SlidersHorizontal } from 'lucide-react'
import type { ViewMode } from './oscarsPhase'
import { Button } from '../../components/ui/Button'
import { OptionRow } from '../../components/ui/OptionRow'
import { Drawer } from '../../components/ui/Drawer'

interface AdminMenuProps {
  viewMode: ViewMode
  onSetViewMode: (mode: ViewMode) => void
}

/* ════════════════════════════════════════════════════════════════════════════
   AdminMenu — header trigger + slide-over for registered admins. Lets an admin
   who is also playing flip between casting their own votes ("Play") and the
   admin controls ("Admin controls"). Only mounted when the viewer can toggle
   (admin AND registered for this tournament); plain admins never see it.
   ════════════════════════════════════════════════════════════════════════════ */
export default function AdminMenu({ viewMode, onSetViewMode }: AdminMenuProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const select = (mode: ViewMode) => {
    onSetViewMode(mode)
    close()
  }

  return (
    <>
      <Button
        variant="neutral"
        size="sm"
        icon={<Settings />}
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
      >
        Menu
      </Button>

      <Drawer open={open} onClose={close} title="Admin menu">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider font-bold text-lob-muted-light px-1">
            View
          </p>
          <div className="space-y-1">
            <OptionRow
              selected={viewMode === 'play'}
              leading={<Gamepad2 size={18} className="text-lob-muted" />}
              title="Play & vote"
              subtitle="Cast your own votes as a participant."
              onClick={() => select('play')}
            />
            <OptionRow
              selected={viewMode === 'admin'}
              leading={<SlidersHorizontal size={18} className="text-lob-muted" />}
              title="Admin controls"
              subtitle="Start, monitor, end and share the games."
              onClick={() => select('admin')}
            />
          </div>
        </div>
      </Drawer>
    </>
  )
}
