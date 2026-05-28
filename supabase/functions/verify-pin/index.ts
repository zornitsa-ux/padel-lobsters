// supabase/functions/verify-pin/index.ts
//
// Authenticates a player by PIN and issues a Supabase session.
// Public endpoint — no Authorization header required.
// Rate limiting and lockout are handled by verify_player_pin_v2 in the DB.
//
// Inputs (POST JSON body):
//   pin:        string  - player's PIN (matched by bcrypt hash)
//   device_id:  string  - stable device identifier (uuid or fingerprint)
//   user_agent: string  - optional; falls back to request User-Agent header
//
// Returns 200 { access_token, refresh_token, role, is_new_device, is_trusted }
//         400 { error: 'missing_fields' | 'invalid_json' }
//         401 { error: 'wrong_pin' | 'rate_limited' | 'locked' | 'invalid_pin' }
//         405 { error: 'method_not_allowed' }
//         500 { error: 'internal_error' }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// Logs the failing stage + upstream detail server-side, and returns a 500 that
// names the stage to the client. The stage is a coarse, non-sensitive label
// (no PINs, tokens, or PII) so a user can report "it failed at generate_link"
// and we can find the cause without guessing across 7 identical error returns.
const fail = (stage: string, detail?: unknown) => {
  console.error(`[verify-pin] stage=${stage}`, detail ?? '')
  return json(500, { error: 'internal_error', stage })
}

const anonHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
}

const serviceHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  let pin: string, device_id: string, user_agent: string
  try {
    const body = await req.json()
    pin = body.pin
    device_id = body.device_id
    user_agent = body.user_agent ?? req.headers.get('user-agent') ?? ''
  } catch {
    return json(400, { error: 'invalid_json' })
  }

  if (!pin || !device_id) return json(400, { error: 'missing_fields' })

  // Step 1: Verify PIN with rate limiting enforced by the DB function
  const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_player_pin_v2`, {
    method: 'POST',
    headers: anonHeaders,
    body: JSON.stringify({
      input_pin: pin,
      input_device_id: device_id,
      input_user_agent: user_agent,
    }),
  })

  if (!rpcResp.ok) {
    return fail('verify_pin_rpc', `http ${rpcResp.status}`)
  }

  const rpcData = (await rpcResp.json()) as Array<{
    player_id: string
    is_new_device: boolean
    trusted: boolean
    status: string
  }>

  const result = rpcData?.[0]
  if (!result) return json(401, { error: 'invalid_pin' })
  if (result.status !== 'ok') return json(401, { error: result.status })

  const { player_id, is_new_device, trusted: is_trusted } = result

  // Step 2: Fetch role from players table
  const playerResp = await fetch(
    `${SUPABASE_URL}/rest/v1/players?id=eq.${player_id}&select=role&limit=1`,
    { headers: serviceHeaders },
  )

  if (!playerResp.ok) {
    return fail('players_lookup', `http ${playerResp.status}`)
  }

  const players = (await playerResp.json()) as Array<{ role: string }>
  const player = players[0]
  if (!player) {
    return fail('player_not_found', player_id)
  }

  const role = player.role

  // Email handling: with magic-link sign-in now in the mix, auth.users.email
  // must be the player's real address when they have one — otherwise magic
  // link can't find them. We:
  //   * Fetch the player's real email from players.email.
  //   * On CREATE (first-ever PIN login): use the real email if set,
  //     otherwise a deterministic synthetic that keeps the row valid.
  //   * On UPDATE: leave the email column alone. The bidirectional sync
  //     trigger (migration 20260528000001) keeps it in step with
  //     players.email; verify-pin only touches app_metadata.
  const playerEmailResp = await fetch(
    `${SUPABASE_URL}/rest/v1/players?id=eq.${player_id}&select=email&limit=1`,
    { headers: serviceHeaders },
  )
  const playerEmailRow = (await playerEmailResp.json()) as Array<{ email: string | null }>
  const realEmail = playerEmailRow[0]?.email?.trim() || ''
  const syntheticEmail = `player-${player_id}@padelobsters.internal`
  const appMetadata = { role, device_trusted: is_trusted, device_id }

  // Step 3: Check if auth.users entry exists and capture its current email.
  const getUserResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${player_id}`, {
    headers: serviceHeaders,
  })

  if (!getUserResp.ok && getUserResp.status !== 404) {
    return fail('get_auth_user', `http ${getUserResp.status}`)
  }

  let authEmail: string
  if (getUserResp.status === 404) {
    authEmail = realEmail || syntheticEmail
    const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: player_id,
        email: authEmail,
        email_confirm: true,
        app_metadata: appMetadata,
      }),
    })
    if (!createResp.ok) {
      return fail('create_auth_user', `http ${createResp.status} ${await createResp.text()}`)
    }
  } else {
    const existing = (await getUserResp.json()) as { email?: string }
    authEmail = existing.email || syntheticEmail
    const updateResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${player_id}`, {
      method: 'PUT',
      headers: serviceHeaders,
      // Only app_metadata — leaving email alone preserves any real address
      // the player set via admin edit or the self-service confirmation flow.
      body: JSON.stringify({ app_metadata: appMetadata }),
    })
    if (!updateResp.ok) {
      return fail('update_auth_user', `http ${updateResp.status} ${await updateResp.text()}`)
    }
  }

  // Step 5: Generate a magic-link token (app_metadata.role is now baked in)
  const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ type: 'magiclink', email: authEmail }),
  })

  if (!linkResp.ok) {
    return fail('generate_link', `http ${linkResp.status} ${await linkResp.text()}`)
  }

  const linkData = (await linkResp.json()) as { hashed_token?: string; action_link?: string }
  const hashed_token = linkData.hashed_token

  if (!hashed_token) {
    return fail('generate_link_no_token', linkData)
  }

  // Step 6: Exchange the magic-link token for a session.
  // GoTrue returns a 302 redirect with tokens in the Location fragment — don't follow it.
  const verifyResp = await fetch(
    `${SUPABASE_URL}/auth/v1/verify?token=${hashed_token}&type=magiclink&redirect_to=${SUPABASE_URL}`,
    { redirect: 'manual' },
  )

  const location = verifyResp.headers.get('location') ?? ''
  const fragment = location.includes('#') ? location.split('#')[1] : ''
  const params = new URLSearchParams(fragment)
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')

  if (!access_token || !refresh_token) {
    return fail('verify_no_tokens', `location=${location}`)
  }

  return json(200, { access_token, refresh_token, role, is_new_device, is_trusted })
})
