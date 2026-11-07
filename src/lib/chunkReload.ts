const KEY = 'chunk-reload-pending'
// The marker is cleared once the app has run this long without another failure,
// so a later deploy in the same tab can auto-reload again.
const SETTLE_MS = 60_000
// Optional chunks: a failure renders nothing, so it isn't worth a reload.
// Content blockers can block analytics by file name.
const SKIP = [/GuestAnalytics-/]

let reloading = false

/** True once a reload has been started, so error UI can show a spinner instead. */
export const isChunkReloading = () => reloading

export function isOptionalChunk({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return SKIP.some((pattern) => pattern.test(message))
}

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function hasMarker({ storage }: { storage: Storage | null }) {
  try {
    return storage?.getItem(KEY) != null
  } catch {
    return false
  }
}

// Reloading is only safe if the marker survives it; without storage it would loop.
function setMarker({ storage }: { storage: Storage | null }) {
  try {
    storage?.setItem(KEY, '1')
    return storage?.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function clearMarker({ storage }: { storage: Storage | null }) {
  try {
    storage?.removeItem(KEY)
  } catch {
    /* storage unavailable */
  }
}

type PreloadErrorEvent = Event & { payload?: unknown }

/**
 * After a deploy, an open tab still asks for the old hashed chunks, which are gone.
 * Vite fires `vite:preloadError` when a dynamic import fails; reload once to pick up
 * the new build. Cancelling the event stops Vite rethrowing. A failure while the
 * marker is set goes through to the error boundary.
 */
export function installChunkReload({
  win = window,
  storage = sessionStore(),
}: { win?: Window; storage?: Storage | null } = {}) {
  setTimeout(() => clearMarker({ storage }), SETTLE_MS)
  win.addEventListener('vite:preloadError', (event: PreloadErrorEvent) => {
    if (reloading) return event.preventDefault()
    if (isOptionalChunk({ error: event.payload })) return
    if (hasMarker({ storage }) || !setMarker({ storage })) return
    reloading = true
    event.preventDefault()
    win.location.reload()
  })
}
