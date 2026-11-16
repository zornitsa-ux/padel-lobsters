import { safeAppPath } from '../../lib/safePath'

export const LEVELLING_PATH = '/levelling'

const FALLBACK = '/home'

/** The flow, returning to `from` (the page that offered it) when done or closed. */
export const levellingPath = ({ from }: { from: string }) =>
  `${LEVELLING_PATH}?${new URLSearchParams({ from }).toString()}`

/** Where the flow returns to: an in-app path from `?from=`, never the flow itself. */
export function returnPathFrom({ search }: { search: string }): string {
  const path = safeAppPath({ input: new URLSearchParams(search).get('from') })
  if (!path || path.startsWith(LEVELLING_PATH)) return FALLBACK
  return path
}
