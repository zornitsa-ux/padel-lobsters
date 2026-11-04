import { ImageResponse } from '@vercel/og'
import { IMAGE_SIZE, fetchPreviewEvent, isEventId } from './_lib/eventPreview'
import { EventImage } from './_lib/EventImage'
import { supabaseEnv } from './_lib/env'

export const config = { runtime: 'edge' }

// The share image for one event. Its URL carries a version (imageVersion), so
// it can be cached hard: an edited event gets a new URL.
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const event = isEventId(id) ? await fetchPreviewEvent({ ...supabaseEnv(), id }) : null
  return new ImageResponse(<EventImage event={event} logo={`${url.origin}/logo-hd.png`} />, {
    ...IMAGE_SIZE,
    headers: {
      'cache-control': event
        ? 'public, max-age=86400, s-maxage=31536000, immutable'
        : 'public, max-age=300, s-maxage=300',
    },
  })
}
