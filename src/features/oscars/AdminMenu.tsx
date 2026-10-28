import { useCallback, useEffect, useRef, useState } from 'react'
import { Settings, X, Gamepad2, SlidersHorizontal } from 'lucide-react'
import type { ViewMode } from './oscarsPhase'
import { IconButton } from '../../components/ui/IconButton'
import { Button } from '../../components/ui/Button'
import { OptionRow } from '../../components/ui/OptionRow'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'

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
  const triggerRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])
  useEscapeToClose({ active: open, onClose: close })

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>('button')?.focus()
  }, [open])

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
        onClick={(event) => {
          triggerRef.current = event.currentTarget
          setOpen(true)
        }}
        aria-label="Open admin menu"
      >
        Menu
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex"
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
        >
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <div
            ref={panelRef}
            className="relative ml-auto h-full w-72 max-w-[85%] bg-white shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-lob-line">
              <h3 className="text-base font-bold text-lob-dark">Admin menu</h3>
              <IconButton onClick={close} aria-label="Close menu" variant="ghost">
                <X />
              </IconButton>
            </div>

            <div className="p-4 space-y-2">
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
          </div>
        </div>
      )}
    </>
  )
}
