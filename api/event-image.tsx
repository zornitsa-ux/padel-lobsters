import { ImageResponse } from '@vercel/og'
import { formatLabel } from '../src/features/events/eventHelpers.js'
import { coral, cream, teal, tealDark } from '../brandColors.js'
import {
  IMAGE_SIZE,
  SITE_NAME,
  formatPreviewDate,
  type PreviewEvent,
  type PreviewLookup,
  lookupPreviewEvent,
  imageUrlFor,
  isEventId,
} from './_lib/eventPreview.js'
import { LOGO_DATA_URL } from './_lib/logo.js'
import { supabaseEnv } from './_lib/env.js'

// Satori renders outside Tailwind, so the brand colours come from the module
// tailwind.config.js builds its lob-* tokens from.
const BRAND = { teal, tealDark, coral, cream, white: '#FFFFFF' }

// 1200×630 share card: who's hosting, what, when, where. No spot count.
function EventImage({ event, logo }: { event: PreviewEvent; logo: string }) {
  const when = formatPreviewDate(event)
  const format = event.format ? formatLabel(event.format) : ''
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        backgroundImage: `linear-gradient(135deg, ${BRAND.teal} 0%, ${BRAND.tealDark} 100%)`,
        color: BRAND.white,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <img src={logo} width={96} height={96} style={{ borderRadius: 48 }} />
        <div style={{ fontSize: 36, color: BRAND.cream }}>{SITE_NAME}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'block', fontSize: 76, lineHeight: 1.05, lineClamp: 2 }}>
          {event.name || SITE_NAME}
        </div>
        {when && <div style={{ fontSize: 40, color: BRAND.cream }}>{when}</div>}
        {event.location && (
          <div style={{ fontSize: 34, color: BRAND.cream, opacity: 0.85 }}>{event.location}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {format ? (
          <div
            style={{
              display: 'flex',
              fontSize: 30,

              padding: '12px 28px',
              borderRadius: 999,
              backgroundColor: BRAND.coral,
            }}
          >
            {format}
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ fontSize: 30, color: BRAND.cream }}>padelobsters.nl</div>
      </div>
    </div>
  )
}

// The share image for one event. Its URL carries a version (imageVersion), so
// it's cached hard: an edited event gets a new URL. Any other URL for the event
// redirects to that one, so made-up versions or params can't each force a render.
// Only real events render; unknown ids get the static site image.
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const lookup: PreviewLookup = isEventId(id)
    ? await lookupPreviewEvent({ ...supabaseEnv(), id })
    : { status: 'missing' }

  // Not cached, so a crawler retries rather than keeping a wrong image.
  if (lookup.status === 'failed') {
    return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
  if (lookup.status === 'missing') {
    return Response.redirect(`${url.origin}/logo-hd.png`, 308)
  }

  const canonical = imageUrlFor({ origin: url.origin, event: lookup.event })
  if (url.href !== canonical) return Response.redirect(canonical, 308)

  return new ImageResponse(<EventImage event={lookup.event} logo={LOGO_DATA_URL} />, {
    ...IMAGE_SIZE,
    headers: { 'cache-control': 'public, max-age=86400, s-maxage=31536000, immutable' },
  })
}

export default { fetch: handler }
