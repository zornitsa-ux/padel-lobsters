// supabase/functions/send-invite-email/index.ts
//
// Tells a player they can sign in to Padel Lobsters with their email address.
// Called from the database via pg_net (private.send_invite_email), authenticated
// with the shared secret in EDGE_SHARED_SECRET. The message carries no
// credential: one button to the app's sign-in page, with the address prefilled.
//
// Inputs (POST JSON body, the full message; this function never reads the database):
//   player_id: uuid          - for logging only
//   email:     string        - recipient
//   name:      string        - personalisation (first name extracted)
//   kind:      'league_invite' | 'added' | 'resend'
//   team_name: string | null - league_invite only: the player's team
//
// Returns 200 { ok: true,  resend_id }                on success
//         4xx { ok: false, error: '...' }             on validation failure
//         401 { ok: false, error: 'unauthorized' }    if no/wrong bearer
//         502 { ok: false, error: 'resend_failed' }   on Resend API error
//
// Required env vars: RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, APP_URL,
// EDGE_SHARED_SECRET (same value as the vault secret 'edge_send_pin_service_role').
//
// Deploy with `verify_jwt = false` (see [functions.send-invite-email] in
// supabase/config.toml), or the gateway demands a JWT before the secret check.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Padel Lobsters <pin@padelobsters.nl>'
const EMAIL_REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://padelobsters.nl'
const EDGE_SHARED_SECRET = Deno.env.get('EDGE_SHARED_SECRET') ?? ''

type Kind = 'league_invite' | 'added' | 'resend'

interface Payload {
  player_id?: string
  email?: string
  name?: string
  kind?: Kind
  team_name?: string | null
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const subjectFor = (kind: Kind): string => {
  switch (kind) {
    case 'league_invite':
      return "You're in the Padel Lobsters league"
    case 'added':
      return 'Welcome to Padel Lobsters'
    case 'resend':
      return 'Sign in to Padel Lobsters'
  }
}

const introFor = ({
  kind,
  firstName,
  teamName,
}: {
  kind: Kind
  firstName: string
  teamName: string | null
}): string => {
  switch (kind) {
    case 'league_invite':
      return teamName
        ? `Hi ${firstName}, your spot with ${teamName} in the Padel Lobsters league is ready.`
        : `Hi ${firstName}, your spot in the Padel Lobsters league is ready.`
    case 'added':
      return `Welcome to Padel Lobsters, ${firstName}! An admin has set up your account.`
    case 'resend':
      return `Hi ${firstName}, here's your link to sign in to Padel Lobsters.`
  }
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (!EDGE_SHARED_SECRET || !auth.startsWith('Bearer ') || auth.slice(7) !== EDGE_SHARED_SECRET) {
    return json(401, { ok: false, error: 'unauthorized' })
  }

  let payload: Payload
  try {
    payload = await req.json()
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }

  const { player_id, email, name, kind, team_name } = payload

  if (!player_id || !email || !kind) {
    return json(400, { ok: false, error: 'missing_fields' })
  }
  if (kind !== 'league_invite' && kind !== 'added' && kind !== 'resend') {
    return json(400, { ok: false, error: 'invalid_kind' })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { ok: false, error: 'invalid_email_format' })
  }

  const safeName = (name ?? '').trim() || 'Lobster'
  const firstName = safeName.split(/\s+/)[0]
  const teamName = kind === 'league_invite' ? (team_name ?? '').trim() || null : null
  const subject = subjectFor(kind)
  const intro = introFor({ kind, firstName, teamName })
  const signInUrl = `${APP_URL}/home?signin=1&email=${encodeURIComponent(email)}`
  const instruction = `You sign in with your email address ${email}.`

  const text =
    `${intro}\n\n` +
    `${instruction}\n\n` +
    `Sign in: ${signInUrl}\n\n` +
    `If you didn't expect this email, reply and we'll sort it out.\n\n` +
    `- Padel Lobsters`

  const html =
    `<!doctype html>` +
    `<html><body style="margin:0;padding:0;background:#FAF3E4;">` +
    `<div style="max-width:480px;margin:24px auto;padding:32px 24px;background:#fff;border-radius:12px;` +
    `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C2B30;line-height:1.5;">` +
    `<p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>` +
    `<p style="margin:0 0 16px 0;">You sign in with your email address <strong>${escapeHtml(email)}</strong>.</p>` +
    `<p style="margin:24px 0;text-align:center;">` +
    `<a href="${escapeHtml(signInUrl)}" style="display:inline-block;padding:12px 24px;background:#D94F2B;color:#fff;` +
    `text-decoration:none;font-weight:600;border-radius:8px;">Sign in</a></p>` +
    `<p style="margin:24px 0 0 0;color:#6B8A92;font-size:13px;">If you didn't expect this email, reply and we'll sort it out.</p>` +
    `<p style="margin:8px 0 0 0;color:#6B8A92;font-size:13px;">- Padel Lobsters</p>` +
    `</div></body></html>`

  let resendResp: Response
  try {
    resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject,
        text,
        html,
        reply_to: EMAIL_REPLY_TO || undefined,
        tags: [
          { name: 'kind', value: kind },
          { name: 'player_id', value: player_id },
        ],
      }),
    })
  } catch (e) {
    console.error('resend fetch threw', { error: String(e), kind, player_id })
    return json(502, { ok: false, error: 'resend_unreachable' })
  }

  const resendBody = await resendResp.json().catch(() => ({}) as Record<string, unknown>)

  if (!resendResp.ok) {
    console.error('resend send failed', {
      status: resendResp.status,
      body: resendBody,
      kind,
      player_id,
    })
    return json(502, {
      ok: false,
      error: 'resend_failed',
      resend_status: resendResp.status,
      resend_error: resendBody,
    })
  }

  return json(200, { ok: true, resend_id: (resendBody as { id?: string }).id })
})
