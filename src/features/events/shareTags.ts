import { readStorage, removeStorage, writeStorage } from '../../lib/safeStorage'

/**
 * Where in the app an event link was shared from (G5). It travels as standard UTM tags,
 * `utm_source=share&utm_content=<placement>`, and is the only thing recorded about a share.
 */
export const SHARE_PLACEMENTS = [
  'home',
  'events-list',
  'event-header',
  'guest-header',
  'info-registered',
  'you-tab',
  'event-created',
] as const

export type SharePlacement = (typeof SHARE_PLACEMENTS)[number]

const SOURCE = 'share'
const STORAGE_KEY = 'pl_share_placement'

const isPlacement = (value: string | null): value is SharePlacement =>
  (SHARE_PLACEMENTS as readonly string[]).includes(value ?? '')

export const shareTagParams = ({ placement }: { placement: SharePlacement }): string =>
  new URLSearchParams({ utm_source: SOURCE, utm_content: placement }).toString()

/** The placement a query string carries, or null unless it's one of ours. */
export function sharePlacementFrom({ search }: { search: string }): SharePlacement | null {
  const params = new URLSearchParams(search)
  const placement = params.get('utm_content')
  return params.get('utm_source') === SOURCE && isPlacement(placement) ? placement : null
}

/** A query string with only our share tags from `search` ('' when it has none). */
export function keepShareTags({ search }: { search: string }): string {
  const placement = sharePlacementFrom({ search })
  return placement ? `?${shareTagParams({ placement })}` : ''
}

/** Adds the share tags from `search` to an in-app path that may already have a query. */
export function withShareTags({ path, search }: { path: string; search: string }): string {
  const tags = keepShareTags({ search }).slice(1)
  if (!tags) return path
  return `${path}${path.includes('?') ? '&' : '?'}${tags}`
}

// First touch for this tab only: sessionStorage, so it's gone when the tab closes.
export function rememberSharePlacement({ search }: { search: string }): void {
  const placement = sharePlacementFrom({ search })
  if (!placement || readStoredSharePlacement()) return
  writeStorage({ area: 'session', key: STORAGE_KEY, value: placement })
}

export function readStoredSharePlacement(): SharePlacement | null {
  const value = readStorage({ area: 'session', key: STORAGE_KEY })
  return isPlacement(value) ? value : null
}

export function forgetSharePlacement(): void {
  removeStorage({ area: 'session', key: STORAGE_KEY })
}
