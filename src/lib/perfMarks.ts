// Load-time instrumentation for the milestones that actually matter to a
// signed-in user. Lighthouse measures FCP/LCP of the app shell, which paints
// before any session or data exists — it scores ~1.0 while the home screen is
// still visibly empty. These marks cover the gap: session resolution, the
// first data request, and the point each home-screen milestone has real data.
//
// Off unless explicitly enabled, so it can be switched on against production
// from a real device:
//   ?perf=1                         one page load
//   localStorage.pl_perf = '1'      sticky, until removed
// Always on in dev.

export type MarkName =
  | 'boot' // entry chunk started executing
  | 'react-mount' // React committed the first render
  | 'session' // auth.getSession() settled (incl. any token refresh)
  | 'first-query' // first PostgREST request issued
  | 'greeting' // signed-in player's name available
  | 'home-data' // tournaments + registrations resolved

const ORDER: MarkName[] = ['boot', 'react-mount', 'session', 'first-query', 'greeting', 'home-data']

const PREFIX = 'pl:'
const REPORT_DELAY_MS = 1500

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.DEV) return true
  try {
    if (new URLSearchParams(window.location.search).get('perf') === '1') return true
    return localStorage.getItem('pl_perf') === '1'
  } catch {
    return false
  }
}

const enabled = isEnabled()
const seen = new Map<MarkName, number>()
let reportTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Record a milestone. First call wins — later calls for the same name are
 * ignored, so a re-render or a refetch can't overwrite the initial load time.
 */
export function mark(name: MarkName): void {
  if (!enabled || seen.has(name)) return
  const t = performance.now()
  seen.set(name, t)
  performance.mark(`${PREFIX}${name}`)
  scheduleReport()
}

// Report once the timeline goes quiet rather than on a specific terminal mark —
// some milestones legitimately never fire (a guest has no 'greeting'), and we
// still want the numbers.
function scheduleReport(): void {
  if (reportTimer) clearTimeout(reportTimer)
  reportTimer = setTimeout(report, REPORT_DELAY_MS)
}

/** The recorded milestones, in load order, as ms since navigation start. */
export function timeline(): { milestone: MarkName; ms: number; delta: number }[] {
  // Sorted by observed time, not by ORDER — milestones legitimately fire out of
  // the expected sequence (a guest's greeting is ready before any query lands),
  // and a timeline that reorders reality produces nonsense deltas.
  const recorded = ORDER.filter((n) => seen.has(n)).sort(
    (a, b) => (seen.get(a) as number) - (seen.get(b) as number),
  )
  let prev = 0
  return recorded.map((name) => {
    const t = seen.get(name) as number
    const row = { milestone: name, ms: Math.round(t), delta: Math.round(t - prev) }
    prev = t
    return row
  })
}

function report(): void {
  const rows = timeline()
  if (rows.length === 0) return
  const last = rows[rows.length - 1]
  console.groupCollapsed(`⏱ load timeline — ${last.milestone} at ${last.ms}ms`)
  console.table(rows)
  console.groupEnd()
}

// Exposed so it can be read from a phone's remote console without waiting for
// the auto-report, and so a test can reset between cases.
if (enabled && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__plPerf = { timeline, report }
}
