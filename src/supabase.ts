import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './lib/database.types'
import { getEnv } from './lib/env'
import { mark } from './lib/perfMarks'

// Every PostgREST request awaits auth.getSession() inside supabase-js
// (_getAccessToken), so the gap between the 'session' and 'first-query' marks
// is the auth cost that data loading is serialised behind. Marking here rather
// than in a query hook catches the true first request whichever one wins.
const instrumentedFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('/rest/v1/')) mark('first-query')
  return fetch(input, init)
}

let client: SupabaseClient<Database> | undefined

// Constructed lazily so importing this module is inert — env validation and
// client construction (and the session warm-up below) only happen on first
// actual use, not at import time.
function getClient() {
  if (client) return client
  const env = getEnv()
  client = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    global: { fetch: instrumentedFetch },
  })
  return client
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    return Reflect.get(getClient(), prop, receiver)
  },
})

let sessionReadyPromise: Promise<Session | null> | undefined

// Warms the session on first access rather than waiting for React to mount
// and useAuth's effect to run. Every PostgREST request awaits getSession()
// internally, so when the stored access token has expired (JWT TTL is 1h) the
// refresh round trip would otherwise sit between mount and the first byte of
// data. auth-js dedupes concurrent callers, so useAuth awaiting this promise
// costs nothing extra.
//
// Guarded to the browser and never rejects — a failure here must not break
// import of the client, it just means the session resolves the normal way.
export function getSessionReady() {
  if (!sessionReadyPromise) {
    sessionReadyPromise =
      typeof window === 'undefined'
        ? Promise.resolve(null)
        : getClient()
            .auth.getSession()
            .then(({ data }) => data.session ?? null)
            .catch(() => null)
  }
  return sessionReadyPromise
}

export default supabase
