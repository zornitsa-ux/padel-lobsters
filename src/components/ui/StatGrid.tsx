import { Children, type ReactNode } from 'react'

const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const

/** A row of `StatTile`s, one column each (two to four). No surface of its own: put it in a card or `Well`. */
export function StatGrid({ children }: { children: ReactNode }) {
  const count = Children.toArray(children).length
  const columns = COLUMNS[Math.min(Math.max(count, 2), 4) as keyof typeof COLUMNS]
  return <div className={`grid gap-2 ${columns}`}>{children}</div>
}
