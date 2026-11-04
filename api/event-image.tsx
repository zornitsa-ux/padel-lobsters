import { ImageResponse } from '@vercel/og'
import {
  IMAGE_SIZE,
  fetchPreviewEvent,
  imageUrlFor,
  imageVersion,
  isEventId,
} from './_lib/eventPreview'
import { EventImage } from './_lib/EventImage'
import { LOGO_DATA_URL } from './_lib/logo'
import { supabaseEnv } from './_lib/env'

export const config = { runtime: 'edge' }

// The share image for one event. Its URL carries a version (imageVersion), so
// it's cached hard: an edited event gets a new URL. Any other `v` redirects to
// the current one, so made-up versions can't each force a fresh render.
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const event = isEventId(id) ? await fetchPreviewEvent({ ...supabaseEnv(), id }) : null

  if (event && url.searchParams.get('v') !== imageVersion({ event })) {
    return Response.redirect(imageUrlFor({ origin: url.origin, event }), 308)
  }

  return new ImageResponse(<EventImage event={event} logo={LOGO_DATA_URL} />, {
    ...IMAGE_SIZE,
    headers: {
      'cache-control': event
        ? 'public, max-age=86400, s-maxage=31536000, immutable'
        : 'public, max-age=300, s-maxage=300',
    },
  })
}
