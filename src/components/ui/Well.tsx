import type { ReactNode } from 'react'

/** A flat inset inside a card or sheet: `lob-well`, no border or shadow. Not a card. */
export function Well({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-lob-well px-4 py-3 space-y-2">{children}</div>
}
