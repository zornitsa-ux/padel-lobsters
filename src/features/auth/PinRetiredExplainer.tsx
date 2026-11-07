import { useState } from 'react'
import { Disclosure } from '../../components/ui/Disclosure'

export const PIN_RETIRED_EXPLAINER =
  "PINs have retired. Enter the email you use for Padel Lobsters and we'll send you a code. Don't know which email that is, or lost access to it? Message an admin on WhatsApp and we'll sort it out."

export function PinRetiredExplainer() {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-1">
      <Disclosure expanded={open} onToggle={() => setOpen((o) => !o)}>
        Used a PIN before?
      </Disclosure>
      {open && <p className="text-sm text-lob-slate leading-snug">{PIN_RETIRED_EXPLAINER}</p>}
    </div>
  )
}
