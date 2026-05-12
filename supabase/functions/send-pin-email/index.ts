// supabase/functions/send-pin-email/index.ts
//
// Sends a Padel Lobsters PIN to a player via Resend.
// Called from the database via pg_net (private.send_pin_email RPC),
// authenticated with the project's service-role key. Anonymous and
// authenticated callers are rejected.
//
// Inputs (POST JSON body):
//   player_id: uuid    - for logging only
//   email:     string  - recipient
//   name:      string  - personalisation in the email body (first name extracted)
//   pin:       string  - 4-8 digit plaintext PIN to deliver
//   kind:      'new_signup' | 'regenerated' | 'forgot_reset'
//                      - selects the email subject + intro line
//
// Returns 200 { ok: true,  resend_id }                on success
//         4xx { ok: false, error: '...' }             on validation failure
//         401 { ok: false, error: 'unauthorized' }    if no/wrong service-role bearer
//         502 { ok: false, error: 'resend_failed' }   on Resend API error
//
// Required env vars (set in Supabase project secrets):
//   RESEND_API_KEY        API key generated in Resend
//   EMAIL_FROM            e.g. "Padel Lobsters <pin@padelobsters.nl>"
//   EMAIL_REPLY_TO        e.g. "zornitsa.mihaylova@gmail.com"
//   APP_URL               e.g. "https://padelobsters.nl"
//   EDGE_SHARED_SECRET    custom random string we control, used by both
//                         this function (env var) and pg_net (vault.secrets
//                         under name 'edge_send_pin_service_role').
//                         Same value on both sides = authenticated call.
//
// Deployment note: this function should be deployed with `verify_jwt = false`
// (toggle off in the Supabase Dashboard's "Deploy a new function" form,
// OR add `verify_jwt = false` under [functions.send-pin-email] in
// supabase/config.toml). Otherwise the gateway demands a valid JWT bearer
// before our auth check ever runs, and a custom shared secret won't pass.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? 'Padel Lobsters <pin@padelobsters.nl>'
const EMAIL_REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://padelobsters.nl'
const EDGE_SHARED_SECRET = Deno.env.get('EDGE_SHARED_SECRET') ?? ''

type Kind = 'new_signup' | 'regenerated' | 'forgot_reset'

interface Payload {
  player_id?: string
  email?: string
  name?: string
  pin?: string
  kind?: Kind
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
    case 'new_signup':
      return 'Welcome to Padel Lobsters - your PIN'
    case 'regenerated':
      return 'Your Padel Lobsters PIN was reset'
    case 'forgot_reset':
      return 'Your new Padel Lobsters PIN'
  }
}

const introFor = (kind: Kind, firstName: string): string => {
  switch (kind) {
    case 'new_signup':
      return `Welcome to Padel Lobsters, ${firstName}! Here's the PIN you'll use to sign in:`
    case 'regenerated':
      return `Hi ${firstName}, an admin just reset your Padel Lobsters PIN. Your new PIN is:`
    case 'forgot_reset':
      return `Hi ${firstName}, a PIN reset was requested for your account. Your new PIN is:`
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

  const { player_id, email, name, pin, kind } = payload

  if (!player_id || !email || !pin || !kind) {
    return json(400, { ok: false, error: 'missing_fields' })
  }
  if (kind !== 'new_signup' && kind !== 'regenerated' && kind !== 'forgot_reset') {
    return json(400, { ok: false, error: 'invalid_kind' })
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return json(400, { ok: false, error: 'invalid_pin_format' })
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(400, { ok: false, error: 'invalid_email_format' })
  }

  const safeName = (name ?? '').trim() || 'Lobster'
  const firstName = safeName.split(/\s+/)[0]
  const subject = subjectFor(kind)
  const intro = introFor(kind, firstName)

  const text =
    `${intro}\n\n` +
    `  ${pin}\n\n` +
    `Use it to sign in at ${APP_URL}.\n\n` +
    `If you didn't expect this email, reply and we'll sort it out.\n\n` +
    `- Padel Lobsters`

  const html =
    `<!doctype html>` +
    `<html><body style="margin:0;padding:0;background:#FAF3E4;">` +
    `<div style="max-width:480px;margin:24px auto;padding:32px 24px;background:#fff;border-radius:12px;` +
    `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C2B30;line-height:1.5;">` +
    `<p style="margin:0 0 16px 0;">${escapeHtml(intro)}</p>` +
    `<p style="margin:24px 0;font-size:32px;letter-spacing:0.4em;font-weight:bold;color:#3D7A8A;text-align:center;font-family:monospace;">` +
    `${escapeHtml(pin)}</p>` +
    `<p style="margin:0 0 16px 0;">Use it to sign in at ` +
    `<a href="${escapeHtml(APP_URL)}" style="color:#D94F2B;text-decoration:none;font-weight:600;">${escapeHtml(APP_URL)}</a>.</p>` +
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
