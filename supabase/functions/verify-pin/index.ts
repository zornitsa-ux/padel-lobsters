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
    console.error('verify_player_pin_v2 http error:', rpcResp.status)
    return json(500, { error: 'internal_error' })
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

  // Step 2: Fetch role and email from players table
  const playerResp = await fetch(
    `${SUPABASE_URL}/rest/v1/players?id=eq.${player_id}&select=role,email&limit=1`,
    { headers: serviceHeaders },
  )

  if (!playerResp.ok) {
    console.error('players lookup http error:', playerResp.status)
    return json(500, { error: 'internal_error' })
  }

  const players = (await playerResp.json()) as Array<{ role: string; email: string | null }>
  const player = players[0]
  if (!player) {
    console.error('player not found:', player_id)
    return json(500, { error: 'internal_error' })
  }

  const role = player.role
  const email = player.email ?? `player-${player_id}@padelobsters.internal`

  // Step 3: Check if auth.users entry exists
  const getUserResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${player_id}`, {
    headers: serviceHeaders,
  })

  if (!getUserResp.ok && getUserResp.status !== 404) {
    console.error('get auth user http error:', getUserResp.status)
    return json(500, { error: 'internal_error' })
  }

  // Step 4: Create or update auth.users entry with current role in app_metadata
  if (getUserResp.status === 404) {
    const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: player_id,
        email,
        email_confirm: true,
        app_metadata: { role, device_trusted: is_trusted, device_id },
      }),
    })
    if (!createResp.ok) {
      console.error('createUser http error:', createResp.status, await createResp.text())
      return json(500, { error: 'internal_error' })
    }
  } else {
    const updateResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${player_id}`, {
      method: 'PUT',
      headers: serviceHeaders,
      body: JSON.stringify({ app_metadata: { role, device_trusted: is_trusted, device_id } }),
    })
    if (!updateResp.ok) {
      console.error('updateUser http error:', updateResp.status, await updateResp.text())
      return json(500, { error: 'internal_error' })
    }
  }

  // Step 5: Generate a magic-link token (app_metadata.role is now baked in)
  const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ type: 'magiclink', email }),
  })

  if (!linkResp.ok) {
    console.error('generate_link http error:', linkResp.status, await linkResp.text())
    return json(500, { error: 'internal_error' })
  }

  const linkData = (await linkResp.json()) as { hashed_token?: string; action_link?: string }
  const hashed_token = linkData.hashed_token

  if (!hashed_token) {
    console.error('generate_link missing hashed_token:', linkData)
    return json(500, { error: 'internal_error' })
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
    console.error('verify did not return tokens; location:', location)
    return json(500, { error: 'internal_error' })
  }

  return json(200, { access_token, refresh_token, role, is_new_device, is_trusted })
})
