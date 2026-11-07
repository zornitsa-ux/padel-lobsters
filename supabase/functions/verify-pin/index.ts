// supabase/functions/verify-pin/index.ts
//
// PIN sign-in is retired (PIN auth removal, PR 4). Every request gets
// 410 { error, code: 'pin_retired' }. Clients from before the cutover show
// `error` to the player verbatim, so it is the sentence they should read.
// Phase 4 (PR 6) deletes this function.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PIN_RETIRED_MESSAGE =
  "PINs have retired. Reload the app and sign in with your email: we'll send you a code."

serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  console.log('[verify-pin] pin_retired')
  return new Response(JSON.stringify({ error: PIN_RETIRED_MESSAGE, code: 'pin_retired' }), {
    status: 410,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
