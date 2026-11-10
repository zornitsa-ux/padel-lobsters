import React from 'react'

const LAYOUT = {
  equal: 'flex gap-2 [&>*]:flex-1',
  end: 'flex items-center justify-end gap-2',
}

/**
 * Two or more buttons sharing a row. Order: the alternative (Cancel, Back) first, the
 * confirming action last. `equal` shares the width; `end` keeps natural widths at the
 * row's end, for a list row's actions under its text.
 */
export function ActionRow({
  children,
  layout = 'equal',
}: {
  children: React.ReactNode
  layout?: keyof typeof LAYOUT
}) {
  return <div className={LAYOUT[layout]}>{children}</div>
}
