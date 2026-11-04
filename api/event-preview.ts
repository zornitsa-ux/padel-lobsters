import {
  SITE_DESCRIPTION,
  SITE_NAME,
  fetchPreviewEvent,
  imageVersion,
  isEventId,
  previewText,
  renderPreviewHtml,
} from './_lib/eventPreview'
import { supabaseEnv } from './_lib/env'

export const config = { runtime: 'edge' }

// Served only to link-preview crawlers on /events/:id and /events/:id/info
// (see vercel.json); people get the app as usual.
export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const pageUrl = isEventId(id) ? `${url.origin}/events/${id}/info` : `${url.origin}/events`
  const event = isEventId(id) ? await fetchPreviewEvent({ ...supabaseEnv(), id }) : null

  const html = event
    ? renderPreviewHtml({
        ...previewText({ event }),
        pageUrl,
        imageUrl: `${url.origin}/api/event-image?id=${event.id}&v=${imageVersion({ event })}`,
      })
    : renderPreviewHtml({
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        pageUrl,
        imageUrl: `${url.origin}/logo-hd.png`,
      })

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}
