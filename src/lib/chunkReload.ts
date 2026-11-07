import { readStorage, writeStorage } from './safeStorage'

const KEY = 'chunk-reload-at'
// A reload that fails again inside this window is a real outage, not a stale tab:
// let the error reach the boundary instead of looping.
const RETRY_WINDOW_MS = 10_000

export function shouldReload({ lastReloadAt, now }: { lastReloadAt: string | null; now: number }) {
  const last = Number(lastReloadAt)
  return !Number.isFinite(last) || now - last > RETRY_WINDOW_MS
}

/**
 * After a deploy, an open tab still asks for the old hashed chunks, which are gone.
 * Vite fires `vite:preloadError` when a dynamic import fails; reload once to pick up
 * the new build. Cancelling the event stops Vite rethrowing.
 */
export function installChunkReload({ win = window }: { win?: Window } = {}) {
  win.addEventListener('vite:preloadError', (event) => {
    const now = Date.now()
    if (!shouldReload({ lastReloadAt: readStorage({ area: 'session', key: KEY }), now })) return
    writeStorage({ area: 'session', key: KEY, value: String(now) })
    event.preventDefault()
    win.location.reload()
  })
}
