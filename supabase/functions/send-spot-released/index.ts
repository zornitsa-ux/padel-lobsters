// supabase/functions/send-spot-released/index.ts
//
// Called from the database via pg_net (private.send_spot_released_email) when
// a registered player is cancelled — by the admin, or by the payment-deadline
// job. Two emails:
//   * spots > 0: the "rare sighting" announcement to every recipient, via
//     Resend's /emails/batch in chunks of 100.
//   * always: a short report to the admins.
//
// Inputs (POST JSON body):
//   tournament_id, tournament_name, when_label  -- event metadata
//   spots:           number   -- spots that opened in a full event (0 = none)
//   trigger_source:  'payment_deadline' | 'admin_cancel'
//   released_names:  string[] -- players who lost their spot
//   recipients:      [{ player_id, first_name, email }]
//
// Auth: same shared-secret Bearer as the other pg_net-called functions.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const EDGE_SHARED_SECRET = Deno.env.get('EDGE_SHARED_SECRET') ?? ''
const EMAIL_FROM =
  Deno.env.get('EMAIL_FROM_TOURNAMENTS') ?? 'Padel Lobsters <tournaments@padelobsters.nl>'
const EMAIL_REPLY_TO = Deno.env.get('EMAIL_REPLY_TO') || 'zornitsa.mihaylova@gmail.com'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://padelobsters.nl'
const ADMIN_RECIPIENTS = ['zornitsa.mihaylova@gmail.com', 'uzielbrito@gmail.com']
const BATCH_SIZE = 100
// Resend's default limit is 2 requests/second.
const BATCH_PAUSE_MS = 600
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface Recipient {
  player_id?: string
  first_name?: string
  email?: string
}
interface Payload {
  tournament_id?: string
  tournament_name?: string
  when_label?: string
  spots?: number
  trigger_source?: string
  released_names?: string[]
  recipients?: Recipient[]
}
interface Announcement {
  tournamentId: string
  tournamentName: string
  whenLabel: string
  spots: number
}
interface SendOutcome {
  sent: number
  failed: { email: string; error: string }[]
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const eventUrl = (tournamentId: string) =>
  `${APP_URL.replace(/\/$/, '')}/events/${encodeURIComponent(tournamentId)}/info`

function announcementCopy({ spots }: { spots: number }) {
  const plural = spots > 1
  return {
    subjectSpots: plural ? `${spots} spots` : 'a spot',
    opened: plural ? `${spots} spots for` : 'A spot for',
    loose: plural ? `This time, ${spots} got loose.` : 'This time, one got loose.',
    grab: plural
      ? 'They go to whoever grabs them first. No queue, no mercy, no second email.'
      : 'It goes to whoever grabs it first. No queue, no mercy, no second email.',
  }
}

function renderAnnouncementHtml({ a, firstName }: { a: Announcement; firstName: string }) {
  const c = announcementCopy({ spots: a.spots })
  const url = escapeHtml(eventUrl(a.tournamentId))
  return (
    `<!doctype html><html><body style="margin:0;padding:0;">` +
    `<div style="max-width:560px;margin:0 auto;padding:32px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C2B30;line-height:1.6;font-size:15px;">` +
    `<p style="margin:0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>` +
    `<p style="margin:0 0 16px 0;">About one in two million lobsters is born blue. A free spot at a sold-out Lobsters event is roughly as common.</p>` +
    `<p style="margin:0 0 16px 0;">${c.opened} <strong>${escapeHtml(a.tournamentName)} · ${escapeHtml(a.whenLabel)}</strong> just opened up. ` +
    `Usually spots change claws directly between players, and nobody else ever hears about it. ${c.loose}</p>` +
    `<p style="margin:0 0 24px 0;">${c.grab}</p>` +
    `<div style="text-align:center;margin:0 0 24px 0;">` +
    `<a href="${url}" style="display:inline-block;background:#D94F2B;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:12px;">Grab the spot →</a>` +
    `</div>` +
    `<p style="margin:0 0 24px 0;">If someone beat you to it, you'll land on the waitlist. Sideways walking won't help.</p>` +
    `<p style="margin:0;">The Lobsters 🦞</p>` +
    `<p style="margin:24px 0 0 0;color:#6B8A92;font-size:11px;line-height:1.5;">You're receiving this because you're a Padel Lobster and aren't registered for ${escapeHtml(a.tournamentName)}.</p>` +
    `</div></body></html>`
  )
}

function renderAnnouncementText({ a, firstName }: { a: Announcement; firstName: string }) {
  const c = announcementCopy({ spots: a.spots })
  return (
    `Hi ${firstName},\n\n` +
    `About one in two million lobsters is born blue. A free spot at a sold-out Lobsters event is roughly as common.\n\n` +
    `${c.opened} ${a.tournamentName} · ${a.whenLabel} just opened up. ` +
    `Usually spots change claws directly between players, and nobody else ever hears about it. ${c.loose}\n\n` +
    `${c.grab}\n\n` +
    `Grab the spot: ${eventUrl(a.tournamentId)}\n\n` +
    `If someone beat you to it, you'll land on the waitlist. Sideways walking won't help.\n\n` +
    `The Lobsters 🦞\n`
  )
}

function buildAnnouncement({ a, recipient }: { a: Announcement; recipient: Required<Recipient> }) {
  const c = announcementCopy({ spots: a.spots })
  return {
    from: EMAIL_FROM,
    to: [recipient.email],
    subject: `🦞 Rare sighting: ${c.subjectSpots} at ${a.tournamentName}`,
    html: renderAnnouncementHtml({ a, firstName: recipient.first_name }),
    text: renderAnnouncementText({ a, firstName: recipient.first_name }),
    reply_to: EMAIL_REPLY_TO,
    headers: {
      'List-Unsubscribe': `<mailto:unsubscribe@padelobsters.nl?subject=Unsubscribe%20${encodeURIComponent(recipient.player_id)}>`,
    },
    tags: [
      { name: 'kind', value: 'spot_released' },
      { name: 'tournament_id', value: a.tournamentId },
      { name: 'player_id', value: recipient.player_id },
    ],
  }
}

function validRecipients(recipients: Recipient[]): Required<Recipient>[] {
  return recipients
    .map((r) => ({
      player_id: (r.player_id ?? '').trim(),
      first_name: (r.first_name ?? '').trim() || 'Lobster',
      email: (r.email ?? '').trim(),
    }))
    .filter((r) => r.player_id && EMAIL_RE.test(r.email))
}

async function sendBatch({ emails }: { emails: ReturnType<typeof buildAnnouncement>[] }) {
  const resp = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(emails),
  })
  const body = await resp.json().catch(() => ({}))
  return { ok: resp.ok, status: resp.status, body }
}

async function sendAnnouncements({
  a,
  recipients,
}: {
  a: Announcement
  recipients: Required<Recipient>[]
}): Promise<SendOutcome> {
  const outcome: SendOutcome = { sent: 0, failed: [] }
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_PAUSE_MS)
    const chunk = recipients.slice(i, i + BATCH_SIZE)
    try {
      const res = await sendBatch({
        emails: chunk.map((recipient) => buildAnnouncement({ a, recipient })),
      })
      if (!res.ok) {
        const error = `resend ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}`
        outcome.failed.push(...chunk.map((r) => ({ email: r.email, error })))
        continue
      }
      const ids: { id?: string }[] = Array.isArray(res.body?.data) ? res.body.data : []
      chunk.forEach((r, idx) => {
        if (typeof ids[idx]?.id === 'string') outcome.sent += 1
        else outcome.failed.push({ email: r.email, error: 'missing_id_in_batch_response' })
      })
    } catch (e) {
      outcome.failed.push(...chunk.map((r) => ({ email: r.email, error: String(e) })))
    }
  }
  return outcome
}

function renderReport({
  a,
  triggerSource,
  releasedNames,
  outcome,
}: {
  a: Announcement
  triggerSource: string
  releasedNames: string[]
  outcome: SendOutcome
}) {
  const names = releasedNames.join(', ') || '—'
  const cause =
    triggerSource === 'payment_deadline'
      ? `Lost their spot (payment deadline passed, still unpaid): ${names}`
      : `Cancelled by an admin: ${names}`
  const announcement =
    a.spots > 0
      ? `Event was full → "rare sighting" email for ${a.spots} spot(s): ${outcome.sent} sent, ${outcome.failed.length} failed.`
      : 'Event was not full → no email to players.'
  const failures = outcome.failed.map((f) => `  ${f.email}: ${f.error}`).join('\n')
  const text =
    `${a.tournamentName} · ${a.whenLabel}\n\n${cause}\n${announcement}\n` +
    (failures ? `\nFailures:\n${failures}\n` : '') +
    `\n${eventUrl(a.tournamentId)}\n`
  return {
    subject: `[Padel Lobsters] Spot released: ${a.tournamentName} — ${names}`,
    text,
    html: `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap;">${escapeHtml(text)}</pre>`,
  }
}

async function sendReport(report: ReturnType<typeof renderReport>) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: ADMIN_RECIPIENTS, ...report }),
  })
  if (!resp.ok) console.error('admin report failed', resp.status, await resp.text().catch(() => ''))
  return resp.ok
}

serve(async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' })

  const auth = req.headers.get('authorization') ?? ''
  if (!EDGE_SHARED_SECRET || auth !== `Bearer ${EDGE_SHARED_SECRET}`) {
    return json(401, { ok: false, error: 'unauthorized' })
  }

  let p: Payload
  try {
    p = await req.json()
  } catch {
    return json(400, { ok: false, error: 'invalid_json' })
  }
  if (!p.tournament_id || !p.tournament_name || !p.when_label) {
    return json(400, { ok: false, error: 'missing_tournament_fields' })
  }

  const a: Announcement = {
    tournamentId: p.tournament_id,
    tournamentName: p.tournament_name,
    whenLabel: p.when_label,
    spots: Math.max(0, Math.floor(Number(p.spots) || 0)),
  }
  const recipients = a.spots > 0 ? validRecipients(p.recipients ?? []) : []
  const outcome = await sendAnnouncements({ a, recipients })
  const reportSent = await sendReport(
    renderReport({
      a,
      triggerSource: p.trigger_source ?? '',
      releasedNames: p.released_names ?? [],
      outcome,
    }),
  )

  return json(200, {
    ok: outcome.failed.length === 0 && reportSent,
    sent: outcome.sent,
    failed: outcome.failed,
    report_sent: reportSent,
  })
})
