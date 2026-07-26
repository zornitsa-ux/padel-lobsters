// ============================================================
//  SUPABASE CONFIGURATION
//  Replace the two values below with your Supabase project values.
//  See SETUP.md for step-by-step instructions.
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { env } from './lib/env'
import { mark } from './lib/perfMarks'

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseKey = env.VITE_SUPABASE_ANON_KEY

// Every PostgREST request awaits auth.getSession() inside supabase-js
// (_getAccessToken), so the gap between the 'session' and 'first-query' marks
// is the auth cost that data loading is serialised behind. Marking here rather
// than in a query hook catches the true first request whichever one wins.
const instrumentedFetch = (input, init) => {
  const url = typeof input === 'string' ? input : (input?.url ?? '')
  if (url.includes('/rest/v1/')) mark('first-query')
  return fetch(input, init)
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: instrumentedFetch },
})

// Warm the session as soon as this module is imported, rather than waiting for
// React to mount and useAuth's effect to run. Every PostgREST request awaits
// getSession() internally, so when the stored access token has expired (JWT
// TTL is 1h) the refresh round trip would otherwise sit between mount and the
// first byte of data. auth-js dedupes concurrent callers, so useAuth awaiting
// this promise costs nothing extra.
//
// Guarded to the browser and never rejects — a failure here must not break
// import of the client, it just means the session resolves the normal way.
export const sessionReady =
  typeof window === 'undefined'
    ? Promise.resolve(null)
    : supabase.auth
        .getSession()
        .then(({ data }) => data.session ?? null)
        .catch(() => null)

export default supabase
