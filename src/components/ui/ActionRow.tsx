import React from 'react'

/**
 * Two or more buttons sharing a row at equal width. Order: the alternative (Cancel,
 * Back) first, the confirming action last.
 */
export function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 [&>*]:flex-1">{children}</div>
}
