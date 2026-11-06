import { formatLabel } from '../../src/features/events/eventHelpers.js'

// Link previews for shared event links. Event facts only: no player data,
// and no spot count, because WhatsApp and Instagram cache previews.

export interface PreviewEvent {
  id: string
  name: string | null
  date: string | null
  time: string | null
  location: string | null
  format: string | null
  status: string | null
}

export const SITE_NAME = 'Padel Lobsters'
export const IMAGE_SIZE = { width: 1200, height: 630 }
export const SITE_DESCRIPTION =
  'The Amsterdam padel community. See upcoming events and join the next one.'

const PREVIEW_COLUMNS = 'id,name,date,time,location,format,status'
const FETCH_TIMEOUT_MS = 2500
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isEventId = (id: string | null): id is string => !!id && UUID.test(id)

export async function fetchPreviewEvent({
  supabaseUrl,
  anonKey,
  id,
}: {
  supabaseUrl: string
  anonKey: string
  id: string
}): Promise<PreviewEvent | null> {
  if (!supabaseUrl || !anonKey) return null
  const url = `${supabaseUrl}/rest/v1/tournaments?select=${PREVIEW_COLUMNS}&id=eq.${id}&limit=1`
  // A preview must never fail the share: any error falls back to the site card.
  try {
    const res = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      // A crawler gives up after a few seconds; fall back before it does.
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as PreviewEvent[]
    return rows[0] ?? null
  } catch {
    return null
  }
}

// Date-only strings are calendar dates: format them in UTC so the server's
// timezone can't shift the day.
export const formatPreviewDate = ({ date, time }: Pick<PreviewEvent, 'date' | 'time'>): string => {
  if (!date) return ''
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  const day = d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  return time ? `${day} · ${time}` : day
}

export const todayUtc = (now = new Date()): string => now.toISOString().slice(0, 10)

// Started, finished or past: the link no longer leads to a sign-up.
export const isClosed = ({ event, today }: { event: PreviewEvent; today: string }): boolean =>
  event.status !== 'upcoming' || (!!event.date && event.date < today)

export function previewText({ event, today }: { event: PreviewEvent; today: string }): {
  title: string
  description: string
} {
  const when = formatPreviewDate(event)
  const what = event.format ? formatLabel(event.format) : ''
  const details = [when, event.location, what].filter(Boolean).join(' · ')
  const ask = isClosed({ event, today })
    ? `Sign-ups are closed. See what's coming up on ${SITE_NAME}.`
    : `See the details and join on ${SITE_NAME}.`
  return {
    title: event.name || `${SITE_NAME} event`,
    description: `${details}${details ? '. ' : ''}${ask}`,
  }
}

// Changes whenever a fact on the image changes, so an edited event gets a new
// image URL instead of a cached old one.
export const imageVersion = ({ event }: { event: PreviewEvent }): string => {
  const key = [event.name, event.date, event.time, event.location, event.format].join('|')
  let hash = 5381
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0
  return hash.toString(36)
}

export const imageUrlFor = ({ origin, event }: { origin: string; event: PreviewEvent }): string =>
  `${origin}/api/event-image?id=${event.id}&v=${imageVersion({ event })}`

const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function renderPreviewHtml({
  title,
  description,
  pageUrl,
  imageUrl,
  appUrl,
}: {
  title: string
  description: string
  pageUrl: string
  imageUrl: string
  /** The link that was opened, plus `app=1`: where a person sent here by mistake goes. */
  appUrl: string
}): string {
  const meta = (attr: 'property' | 'name', key: string, value: string) =>
    `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`
  return [
    '<!doctype html>',
    '<html lang="en"><head><meta charset="utf-8" />',
    `<title>${escapeHtml(title)} · ${SITE_NAME}</title>`,
    meta('name', 'description', description),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:type', 'website'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:url', pageUrl),
    meta('property', 'og:image', imageUrl),
    meta('property', 'og:image:width', String(IMAGE_SIZE.width)),
    meta('property', 'og:image:height', String(IMAGE_SIZE.height)),
    meta('name', 'twitter:card', 'summary_large_image'),
    // `app=1` makes vercel.json skip this route, so the app loads.
    `<script>location.replace(${JSON.stringify(appUrl).replace(/</g, '\\u003c')})</script>`,
    '</head><body>',
    `<a href="${escapeHtml(appUrl)}">${escapeHtml(title)}</a>`,
    '</body></html>',
  ].join('\n')
}

// The URL that was opened (path and query, e.g. `?src=wa`), with `app=1`, so a
// person sent here by mistake lands where the link pointed.
export function appUrlFor({
  origin,
  id,
  tab,
  search,
}: {
  origin: string
  id: string
  tab: string | null
  search: URLSearchParams
}): string {
  const params = new URLSearchParams(search)
  params.delete('id')
  params.delete('tab')
  params.set('app', '1')
  return `${origin}/events/${id}${tab === 'info' ? '/info' : ''}?${params.toString()}`
}
