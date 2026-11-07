import {
  appUrlFor,
  fetchPreviewEvent,
  imageUrlFor,
  isEventId,
  previewText,
  renderPreviewHtml,
  todayInAmsterdam,
} from './_lib/eventPreview.js'
import { supabaseEnv } from './_lib/env.js'
import { SITE_DESCRIPTION, SITE_IMAGE_PATH, SITE_NAME } from '../siteMeta.js'

// Served only to link-preview crawlers on /events/:id and /events/:id/info
// (see vercel.json); people get the app as usual.
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const tab = url.searchParams.get('tab')
  const valid = isEventId(id)
  const pageUrl = valid ? `${url.origin}/events/${id}/info` : `${url.origin}/events`
  const appUrl = valid
    ? appUrlFor({ origin: url.origin, id, tab, search: url.searchParams })
    : `${url.origin}/events?app=1`
  const event = valid ? await fetchPreviewEvent({ ...supabaseEnv(), id }) : null

  const html = event
    ? renderPreviewHtml({
        ...previewText({ event, today: todayInAmsterdam() }),
        pageUrl,
        appUrl,
        imageUrl: imageUrlFor({ origin: url.origin, event }),
      })
    : renderPreviewHtml({
        title: SITE_NAME,
        description: SITE_DESCRIPTION,
        pageUrl,
        appUrl,
        imageUrl: `${url.origin}${SITE_IMAGE_PATH}`,
      })

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600',
    },
  })
}

export default { fetch: handler }
