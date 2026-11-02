import { Children, Fragment, isValidElement, type ReactNode } from 'react'

const COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' } as const

// Tiles inside a fragment (a conditional group) count one each.
const countTiles = (children: ReactNode): number =>
  Children.toArray(children).reduce<number>(
    (n, child) =>
      n +
      (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
        ? countTiles(child.props.children)
        : 1),
    0,
  )

/** A row of `StatTile`s, one column each (one to four). No surface of its own: put it in a card or `Well`. */
export function StatGrid({ children }: { children: ReactNode }) {
  const count = Math.min(Math.max(countTiles(children), 1), 4) as keyof typeof COLUMNS
  return <div className={`grid gap-2 ${COLUMNS[count]}`}>{children}</div>
}
